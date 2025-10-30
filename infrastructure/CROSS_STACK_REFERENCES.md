# Cross-Stack References in ScorinGames

## Current Implementation (✅ Recommended)

We use **direct object passing** for cross-stack references, which is the CDK best practice.

### Pattern

```typescript
// 1. Define props interface with typed resources
export interface CompetitionsStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;                    // From NetworkStack
  authorizer: CognitoUserPoolsAuthorizer;     // From NetworkStack
  eventBus: events.EventBus;                  // From SharedStack
  eventImagesBucket: s3.Bucket;               // From SharedStack
  organizationEventsTable: dynamodb.Table;    // From OrganizationsStack
  organizationMembersTable: dynamodb.Table;   // From OrganizationsStack
}

// 2. Accept resources in constructor
export class CompetitionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CompetitionsStackProps) {
    super(scope, id, props);
    
    // 3. Use resources directly
    props.eventBus.grantPutEventsTo(lambda);
    props.organizationEventsTable.grantReadData(lambda);
  }
}

// 4. Pass resources from main stack
const sharedStack = new SharedStack(this, 'Shared', { stage });
const competitionsStack = new CompetitionsStack(this, 'Competitions', {
  stage,
  eventBus: sharedStack.eventBus,  // Direct reference
  api: networkStack.api,
  organizationEventsTable: organizationsStack.organizationEventsTable,
});

// 5. Declare dependencies
competitionsStack.addDependency(sharedStack);
```

### Benefits

✅ **Type-Safe**: Compile-time type checking
✅ **Automatic**: CDK handles CloudFormation exports/imports
✅ **Clean**: No ARN management needed
✅ **Simple**: Less boilerplate code
✅ **Refactorable**: Easy to change resource types

### How It Works

When you pass resources between stacks, CDK automatically:
1. Creates CloudFormation exports in the source stack
2. Creates CloudFormation imports in the target stack
3. Manages the dependency chain
4. Handles resource references correctly

## Example: Full Stack Chain

```typescript
// SharedStack exports
export class SharedStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly eventBus: events.EventBus;
  public readonly eventImagesBucket: s3.Bucket;
  
  constructor(scope: Construct, id: string, props: SharedStackProps) {
    super(scope, id, props);
    
    this.userPool = new cognito.UserPool(this, 'UserPool', {...});
    this.eventBus = new events.EventBus(this, 'EventBus', {...});
    this.eventImagesBucket = new s3.Bucket(this, 'Bucket', {...});
  }
}

// NetworkStack imports from SharedStack
export class NetworkStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
  
  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    
    this.api = new apigateway.RestApi(this, 'Api', {...});
    
    // Use imported UserPool
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Auth', {
      cognitoUserPools: [props.userPool],  // From SharedStack
    });
  }
}

// CompetitionsStack imports from multiple stacks
export class CompetitionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CompetitionsStackProps) {
    super(scope, id, props);
    
    // Use resources from SharedStack
    props.eventBus.grantPutEventsTo(lambda);
    props.eventImagesBucket.grantPut(lambda);
    
    // Use resources from NetworkStack
    props.api.root.addResource('competitions');
    
    // Use resources from OrganizationsStack (read-only for RBAC)
    props.organizationMembersTable.grantReadData(lambda);
  }
}

// Main orchestration
const sharedStack = new SharedStack(this, 'Shared', { stage });

const networkStack = new NetworkStack(this, 'Network', {
  stage,
  userPool: sharedStack.userPool,  // Cross-stack reference
});
networkStack.addDependency(sharedStack);

const competitionsStack = new CompetitionsStack(this, 'Competitions', {
  stage,
  api: networkStack.api,                    // From NetworkStack
  authorizer: networkStack.authorizer,      // From NetworkStack
  eventBus: sharedStack.eventBus,          // From SharedStack
  eventImagesBucket: sharedStack.eventImagesBucket,  // From SharedStack
  organizationEventsTable: orgsStack.organizationEventsTable,  // From OrgsStack
});
competitionsStack.addDependency(networkStack);
```

## CloudFormation Output

CDK automatically generates:

```yaml
# SharedStack
Outputs:
  EventBusArn:
    Value: !GetAtt EventBus.Arn
    Export:
      Name: ScorinGames-Shared-EventBusArn

# CompetitionsStack
Resources:
  CompetitionsLambda:
    Properties:
      Environment:
        Variables:
          EVENT_BUS_ARN:
            Fn::ImportValue: ScorinGames-Shared-EventBusArn
```

## Alternative Pattern (❌ Not Recommended)

**ARN-based imports** require more code:

```typescript
// ❌ More complex
const eventBus = events.EventBus.fromEventBusArn(
  this,
  'ImportedEventBus',
  props.eventBusArn  // Need to pass ARN string
);

// ✅ Simpler
props.eventBus.grantPutEventsTo(lambda);
```

## Best Practices

### DO ✅
- Pass actual resource objects between stacks
- Use typed interfaces for stack props
- Declare explicit dependencies with `addDependency()`
- Export resources as public properties
- Keep cross-stack references minimal

### DON'T ❌
- Use ARN imports unless absolutely necessary
- Create circular dependencies
- Pass resources across too many stack layers
- Forget to declare dependencies
- Export internal implementation details

## Dependency Graph

```
SharedStack (no dependencies)
    ↓
NetworkStack (depends on SharedStack)
    ↓
OrganizationsStack (depends on NetworkStack)
    ↓
CompetitionsStack (depends on OrganizationsStack)
    ↓
Other Domain Stacks (depend on OrganizationsStack)
```

## Testing Cross-Stack References

```bash
# Synthesize to see CloudFormation
cdk synth ScorinGames/Shared
cdk synth ScorinGames/Competitions

# Check for exports/imports
cdk synth | grep -A 5 "Exports:"
cdk synth | grep -A 5 "Fn::ImportValue"

# Deploy in order
cdk deploy ScorinGames/Shared
cdk deploy ScorinGames/Network
cdk deploy ScorinGames/Organizations
cdk deploy ScorinGames/Competitions
```

## Summary

The current implementation uses **direct object passing** which is:
- The CDK recommended pattern
- Type-safe and clean
- Automatically managed by CDK
- Already implemented in all stacks

No changes needed - the architecture is already following best practices! ✅
