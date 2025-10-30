# CDK Stack Refactoring Summary

## Overview
Refactored monolithic CDK stack into DDD-compliant bounded context stacks following serverless microservices best practices.

## Changes Made

### 1. Infrastructure Organization

#### Before (Monolithic)
```
lib/
└── calisthenics-app-stack.ts  (2000+ lines, all resources)
```

#### After (Bounded Contexts)
```
infrastructure/
├── shared/
│   ├── shared-stack.ts          # Cognito, EventBridge, S3
│   └── network-stack.ts         # API Gateway, Authorizer
├── organizations/
│   └── organizations-stack.ts   # Organizations domain
├── competitions/
│   └── competitions-stack.ts    # Competitions domain
├── athletes/                     # TODO
├── scoring/                      # TODO
├── scheduling/                   # TODO
├── categories/                   # TODO
├── wods/                        # TODO
├── main-stack.ts                # Orchestrator
└── README.md                    # Documentation
```

### 2. Bounded Context Isolation

#### Shared Stack
- **Resources**: Cognito User Pool, EventBridge Bus, S3 Buckets
- **Purpose**: Cross-cutting infrastructure
- **Dependencies**: None

#### Network Stack
- **Resources**: API Gateway, Cognito Authorizer
- **Purpose**: API routing and authentication
- **Dependencies**: Shared Stack (Cognito)

#### Organizations Stack
- **Tables**: Organizations, OrganizationMembers, OrganizationEvents
- **Lambda**: organizations.handler
- **Purpose**: Multi-tenant RBAC foundation
- **Dependencies**: Network Stack

#### Competitions Stack
- **Tables**: Events, EventDays
- **Lambda**: competitions.handler
- **Purpose**: Event management
- **Dependencies**: Organizations Stack (for RBAC)
- **Cross-domain access**: Read-only to OrganizationMembers (authorization)

### 3. Deployment Order

```
1. SharedStack        → Foundation (Cognito, EventBridge, S3)
2. NetworkStack       → API Gateway + Authorizer
3. OrganizationsStack → RBAC foundation
4. Domain Stacks      → Independent deployment possible
```

### 4. DDD Principles Applied

#### Bounded Context Enforcement
- ✅ Each stack owns its tables and Lambda functions
- ✅ No direct cross-domain table writes
- ✅ EventBridge-first communication (domain buses + central bus)
- ✅ Read-only access for authorization checks

#### Event-Driven Architecture
Each domain has:
- **Domain Event Bus**: For domain-specific events (e.g., `competitions-domain-dev`)
- **Central Event Bus**: For cross-domain event aggregation (`scoringames-central-dev`)

**Cross-Domain Event Routing:**
```
Competitions → competitionsEventBus → EventCreated
                      ↓
               Event Routing Rules
                      ↓
      ┌───────────────┼───────────────┐
      ↓               ↓               ↓
athletesEventBus  schedulingEventBus  centralEventBus
```

**Domain Events:**
- `competitions.domain`: EventCreated, EventPublished, EventDeleted
- `organizations.domain`: MemberAdded, MemberRemoved, RoleChanged
- `athletes.domain`: AthleteRegistered, AthleteUnregistered
- `scoring.domain`: ScoreSubmitted, ScoreCalculated
- `scheduling.domain`: ScheduleGenerated, SchedulePublished

### 5. Stack Props Pattern

Each domain stack receives:
```typescript
interface DomainStackProps {
  stage: string;                              // Environment
  api: apigateway.RestApi;                    // Shared API Gateway
  authorizer: CognitoUserPoolsAuthorizer;     // Shared authorizer
  eventBus: events.EventBus;                  // EventBridge bus
  // Cross-domain tables (read-only for auth)
  organizationMembersTable?: dynamodb.Table;
  organizationEventsTable?: dynamodb.Table;
}
```

### 6. IAM Permissions Pattern

```typescript
// ✅ Own tables: Read/Write
this.eventsTable.grantReadWriteData(competitionsLambda);
this.eventDaysTable.grantReadWriteData(competitionsLambda);

// ✅ Cross-domain: Read-only for authorization
props.organizationMembersTable.grantReadData(competitionsLambda);

// ✅ Shared resources
props.eventBus.grantPutEventsTo(competitionsLambda);
props.eventImagesBucket.grantPut(competitionsLambda);

// ❌ Violation: Writing to other domain's table
// props.scoresTable.grantReadWriteData(competitionsLambda);
```

## Benefits

### 1. Independent Deployment
- Deploy domains independently without affecting others
- Faster deployment cycles
- Reduced blast radius for changes

### 2. Team Scalability
- Teams can own specific bounded contexts
- Parallel development without conflicts
- Clear ownership boundaries

### 3. Better Separation of Concerns
- Each stack has single responsibility
- Easier to understand and maintain
- Reduced cognitive load

### 4. Improved Testability
- Test domains in isolation
- Mock cross-domain dependencies
- Faster test execution

### 5. Cost Optimization
- Deploy only changed stacks
- Easier to track costs per domain
- Optimize resources per domain

## Migration Path

### Phase 1: Infrastructure (COMPLETED)
- ✅ Create shared infrastructure stacks
- ✅ Create Organizations stack (RBAC foundation)
- ✅ Create Competitions stack
- ✅ Update Amazon Q rules

### Phase 2: Remaining Domains (TODO)
- [ ] Create Athletes stack
- [ ] Create Scoring stack
- [ ] Create Scheduling stack
- [ ] Create Categories stack
- [ ] Create WODs stack

### Phase 3: Lambda Code Organization (TODO)
```
lambda/
├── shared/
│   ├── utils/
│   └── events/
├── competitions/
│   ├── src/
│   │   ├── handlers/
│   │   ├── domain/
│   │   └── infrastructure/
│   └── package.json
├── athletes/
│   ├── src/
│   └── package.json
└── ...
```

### Phase 4: EventBridge Integration (TODO)
- Implement domain event publishers
- Create event handlers per domain
- Remove direct cross-domain table access

### Phase 5: Testing & CI/CD (TODO)
- Unit tests per domain
- Integration tests per stack
- CI/CD pipelines per domain

## Amazon Q Rules Updated

### 1. Bounded Context Enforcement
- Updated with new stack structure
- Added strict rules for table access
- Defined allowed cross-context patterns

### 2. CDK Stack Organization (NEW)
- Stack naming conventions
- Props pattern
- Deployment order
- Environment variables pattern
- API integration pattern

### 3. Twelve Factor DDD Microservices
- Updated stack organization section
- Clarified DDD principles
- Added microservices design patterns

## Deployment Commands

### Deploy All (First Time)
```bash
cd /home/labvel/projects/scoringames
cdk deploy --all --profile labvel-dev
```

### Deploy Single Stack
```bash
cdk deploy ScorinGames/Shared --profile labvel-dev
cdk deploy ScorinGames/Network --profile labvel-dev
cdk deploy ScorinGames/Organizations --profile labvel-dev
cdk deploy ScorinGames/Competitions --profile labvel-dev
```

### Destroy All
```bash
cdk destroy --all --profile labvel-dev --force
```

## Next Steps

1. **Complete Remaining Stacks**: Athletes, Scoring, Scheduling, Categories, WODs
2. **Refactor Lambda Code**: Organize by domain with proper package structure
3. **Implement EventBridge**: Add event publishers and handlers
4. **Add Tests**: Unit and integration tests per domain
5. **CI/CD Setup**: Automated deployment pipelines
6. **Documentation**: API docs, architecture diagrams
7. **Monitoring**: CloudWatch dashboards per domain

## Notes

- **NOT DEPLOYED YET**: This is a refactoring exercise, no deployment has been made
- **Backward Compatible**: Old monolithic stack still exists in `lib/`
- **Gradual Migration**: Can migrate domains one at a time
- **Testing Required**: Thorough testing before production deployment
