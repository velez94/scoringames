# ScorinGames Infrastructure

## Architecture Overview

This infrastructure follows **Domain-Driven Design (DDD)** principles with **serverless microservices** architecture using AWS CDK.

## Stack Organization

### Deployment Order

```
1. SharedStack        → Cognito, EventBridge, S3
2. NetworkStack       → API Gateway, Authorizer
3. OrganizationsStack → RBAC foundation
4. Domain Stacks      → Competitions, Athletes, Scoring, etc.
```

### Stack Structure

```
infrastructure/
├── shared/
│   ├── shared-stack.ts          # Cognito, EventBridge, S3
│   └── network-stack.ts         # API Gateway, Authorizer
├── organizations/
│   └── organizations-stack.ts   # Organizations, Members, RBAC
├── competitions/
│   └── competitions-stack.ts    # Events, EventDays
├── athletes/
│   └── athletes-stack.ts        # Athletes, AthleteEvents (TODO)
├── scoring/
│   └── scoring-stack.ts         # Scores, Leaderboards (TODO)
├── scheduling/
│   └── scheduling-stack.ts      # Schedules, Heats (TODO)
├── categories/
│   └── categories-stack.ts      # Categories (TODO)
├── wods/
│   └── wods-stack.ts           # WODs (TODO)
└── main-stack.ts               # Orchestrator
```

## Bounded Contexts

### 1. Shared Infrastructure
- **Resources**: Cognito User Pool, EventBridge, S3 Buckets
- **Purpose**: Cross-cutting concerns
- **Dependencies**: None

### 2. Network Infrastructure
- **Resources**: API Gateway, Cognito Authorizer
- **Purpose**: API routing and authentication
- **Dependencies**: Shared Stack

### 3. Organizations Domain
- **Tables**: Organizations, OrganizationMembers, OrganizationEvents
- **Lambda**: organizations.handler
- **Purpose**: Multi-tenant RBAC
- **Dependencies**: Network Stack

### 4. Competitions Domain
- **Tables**: Events, EventDays
- **Lambda**: competitions.handler
- **Purpose**: Event management
- **Dependencies**: Organizations Stack (for RBAC)

### 5. Athletes Domain (TODO)
- **Tables**: Athletes, AthleteEvents
- **Lambda**: athletes.handler
- **Purpose**: Athlete profiles and registrations

### 6. Scoring Domain (TODO)
- **Tables**: Scores, ScoringSystem, LeaderboardCache
- **Lambda**: scores.handler, leaderboard.handler
- **Purpose**: Score submission and leaderboards

### 7. Scheduling Domain (TODO)
- **Tables**: Schedules, Heats, ClassificationFilters
- **Lambda**: scheduler.handler
- **Purpose**: Competition scheduling

### 8. Categories Domain (TODO)
- **Tables**: Categories
- **Lambda**: categories.handler
- **Purpose**: Competition categories

### 9. WODs Domain (TODO)
- **Tables**: WODs
- **Lambda**: wods.handler
- **Purpose**: Workout templates

## DDD Principles

### Bounded Context Isolation
- Each domain stack owns its tables and Lambda functions
- No direct cross-domain table access
- Communication via EventBridge (domain buses + central bus)

### Event-Driven Architecture
Each domain has:
- **Domain Event Bus**: For domain-specific events
- **Central Event Bus**: For cross-domain event aggregation

**Event Flow:**
```
Competitions Domain → competitionsEventBus → EventCreated
                           ↓
                    Event Routing Rules
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
athletesEventBus   schedulingEventBus   centralEventBus
```

**Domain Events:**
- `competitions.domain`: EventCreated, EventPublished, EventDeleted
- `organizations.domain`: MemberAdded, MemberRemoved, RoleChanged
- `athletes.domain`: AthleteRegistered, AthleteUnregistered
- `scoring.domain`: ScoreSubmitted, ScoreCalculated
- `scheduling.domain`: ScheduleGenerated, SchedulePublished

## Deployment

### Prerequisites
```bash
npm install
```

### Deploy All Stacks
```bash
cdk deploy --all --profile labvel-dev
```

### Deploy Single Stack
```bash
cdk deploy ScorinGames/Shared --profile labvel-dev
cdk deploy ScorinGames/Network --profile labvel-dev
cdk deploy ScorinGames/Organizations --profile labvel-dev
cdk deploy ScorinGames/Competitions --profile labvel-dev
```

### Destroy All Stacks
```bash
cdk destroy --all --profile labvel-dev --force
```

## Best Practices

### ✅ DO
- Keep each stack focused on a single bounded context
- Use EventBridge for cross-domain communication
- Grant read-only access to organization tables for RBAC
- Use environment variables for all configuration
- Follow the deployment order

### ❌ DON'T
- Access tables from other bounded contexts directly
- Create circular dependencies between stacks
- Hardcode table names or ARNs
- Mix domain responsibilities in a single Lambda
- Deploy domain stacks before Organizations stack

## Migration from Monolithic Stack

The previous monolithic `lib/calisthenics-app-stack.ts` has been refactored into:
1. Shared infrastructure (Cognito, EventBridge, S3)
2. Network infrastructure (API Gateway)
3. Domain-specific stacks (Organizations, Competitions, etc.)

This enables:
- Independent deployment of domains
- Better separation of concerns
- Easier testing and maintenance
- Scalable team structure

## Next Steps

1. Complete remaining domain stacks (Athletes, Scoring, etc.)
2. Migrate Lambda code to domain-specific packages
3. Implement EventBridge event handlers
4. Add integration tests per domain
5. Set up CI/CD pipelines per stack
