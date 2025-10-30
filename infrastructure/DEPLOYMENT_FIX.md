# Circular Dependency Fix

## Problem
Domain stacks were receiving API Gateway and adding routes directly, creating circular dependencies:
- Network stack creates API Gateway
- Organizations stack receives API and adds routes
- Network stack tries to reference Organizations Lambda ARN
- **Circular dependency!**

## Solution
**Separation of Concerns**:
1. **Domain Stacks**: Only create resources (tables, Lambdas, event buses)
2. **Main Stack**: Wires API routes to Lambda functions

## Pattern

### Domain Stack (e.g., Organizations)
```typescript
export interface OrganizationsStackProps {
  stage: string;
  eventBus: events.EventBus;
  // NO API or Authorizer!
}

export class OrganizationsStack {
  public readonly organizationsLambda: lambda.Function; // Export Lambda
  
  constructor() {
    // Create Lambda
    this.organizationsLambda = new lambda.Function(...);
    
    // NO API integration here!
  }
}
```

### Main Stack
```typescript
// Create domain stack
const organizationsStack = new OrganizationsStack(this, 'Organizations', {
  stage: props.stage,
  eventBus: sharedStack.eventBus,
});

// Wire API routes in main stack
const organizations = networkStack.api.root.addResource('organizations');
organizations.addMethod('ANY', 
  new apigateway.LambdaIntegration(organizationsStack.organizationsLambda), 
  { authorizer: networkStack.authorizer }
);
```

## Benefits
✅ No circular dependencies
✅ Domain stacks are truly independent
✅ Can deploy domain stacks separately
✅ Main stack orchestrates API routing
✅ Follows DDD bounded context principles

## Deployment Order
1. Shared Stack (Cognito, EventBridge, S3)
2. Network Stack (API Gateway)
3. Organizations Stack (independent)
4. Other Domain Stacks (parallel deployment possible)
5. Main Stack wires everything together

## Independent Deployment
```bash
# Deploy single domain
cdk deploy ScorinGames/Organizations --profile labvel-dev

# Deploy all
cdk deploy --all --profile labvel-dev
```
