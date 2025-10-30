# CDK Stack Organization

## Purpose
Defines the proper organization of CDK stacks following DDD bounded contexts and microservices architecture.

## Priority
**Critical** - Must be followed without exception

## Instructions

### Stack Structure
```
infrastructure/
├── shared/
│   ├── shared-stack.ts          // Cognito, EventBridge, S3
│   └── network-stack.ts         // API Gateway, Authorizer
├── competitions/
│   └── competitions-stack.ts    // Events, EventDays
├── athletes/
│   └── athletes-stack.ts        // Athletes, AthleteEvents
├── scoring/
│   └── scoring-stack.ts         // Scores, ScoringSystem, Leaderboard
├── organizations/
│   └── organizations-stack.ts   // Organizations, Members, Events
├── scheduling/
│   └── scheduling-stack.ts      // Schedules, Heats, Filters
├── categories/
│   └── categories-stack.ts      // Categories
├── wods/
│   └── wods-stack.ts           // WODs
└── main-stack.ts               // Orchestrates all stacks
```

### Stack Naming Convention
- Format: `{Domain}Stack` (e.g., `CompetitionsStack`, `OrganizationsStack`)
- Shared stacks: `SharedStack`, `NetworkStack`
- Main orchestrator: `ScorinGamesStack`

### Stack Props Pattern
Each domain stack receives:
- `stage`: Environment (dev, staging, prod)
- `api`: API Gateway from NetworkStack
- `authorizer`: Cognito authorizer from NetworkStack
- `eventBus`: EventBridge bus from SharedStack
- Cross-domain table references (read-only for authorization)

### Deployment Order
1. SharedStack (Cognito, EventBridge, S3)
2. NetworkStack (API Gateway)
3. OrganizationsStack (RBAC foundation)
4. Domain Stacks (parallel deployment possible)

### Table Access Rules
Each stack MUST only grant read/write to its own tables:
```typescript
// ✅ Correct
this.eventsTable.grantReadWriteData(competitionsLambda);
this.eventDaysTable.grantReadWriteData(competitionsLambda);

// ✅ Allowed: Read-only for authorization
props.organizationMembersTable.grantReadData(competitionsLambda);

// ❌ Violation: Writing to other domain's table
props.scoresTable.grantReadWriteData(competitionsLambda);
```

### Environment Variables Pattern
```typescript
environment: {
  // Own tables
  EVENTS_TABLE: this.eventsTable.tableName,
  EVENT_DAYS_TABLE: this.eventDaysTable.tableName,
  
  // Cross-domain (read-only for auth)
  ORGANIZATION_MEMBERS_TABLE: props.organizationMembersTable.tableName,
  
  // Shared resources
  EVENT_BUS_NAME: props.eventBus.eventBusName,
  EVENT_IMAGES_BUCKET: props.eventImagesBucket.bucketName,
}
```

### API Integration Pattern
```typescript
// Domain endpoints
const resource = props.api.root.addResource('domain-name');
resource.addMethod('ANY', new apigateway.LambdaIntegration(lambda), {
  authorizer: props.authorizer,
});

// Proxy for sub-resources
const proxy = resource.addResource('{proxy+}');
proxy.addMethod('ANY', new apigateway.LambdaIntegration(lambda), {
  authorizer: props.authorizer,
});

// Public endpoints (no auth)
const publicResource = props.api.root.getResource('public')?.addResource('domain');
publicResource.addMethod('GET', new apigateway.LambdaIntegration(lambda));
```

## Error Handling
- If stack dependencies are circular, redesign the domain boundaries
- If a Lambda needs write access to another domain's table, use EventBridge instead
- If deployment order is unclear, check the dependency graph
- If a stack is too large, consider splitting into sub-domains

## Enforcement
- Review all stack definitions for proper bounded context isolation
- Ensure IAM permissions match domain boundaries
- Verify EventBridge is used for cross-context communication
- Check that each stack can be deployed independently
