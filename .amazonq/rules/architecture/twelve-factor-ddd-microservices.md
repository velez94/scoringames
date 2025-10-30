# Twelve Factor, DDD & Microservices Architecture

## Purpose
Ensures ScorinGames platform follows Twelve Factor App principles, Domain-Driven Design (DDD), and microservices best practices for scalable, maintainable, and cloud-native architecture.

## Priority
**Critical** - Must be followed without exception

## Instructions

### Twelve Factor App Principles
- **I. Codebase**: One codebase tracked in revision control, many deploys (Git repository per service)
- **II. Dependencies**: Explicitly declare and isolate dependencies (package.json, requirements.txt)
- **III. Config**: Store config in environment variables (AWS_REGION, TABLE_NAMES, API_URLS)
- **IV. Backing Services**: Treat backing services as attached resources (DynamoDB, S3, Cognito)
- **V. Build/Release/Run**: Strictly separate build and run stages (CDK build → deploy → Lambda execution)
- **VI. Processes**: Execute as stateless processes (Lambda functions with no local state)
- **VII. Port Binding**: Export services via port binding (API Gateway endpoints)
- **VIII. Concurrency**: Scale out via process model (Lambda concurrent executions)
- **IX. Disposability**: Fast startup and graceful shutdown (Lambda cold starts optimization)
- **X. Dev/Prod Parity**: Keep development and production as similar as possible
- **XI. Logs**: Treat logs as event streams (CloudWatch Logs structured logging)
- **XII. Admin Processes**: Run admin tasks as one-off processes (separate Lambda functions)

### Domain-Driven Design (DDD)
- **Bounded Contexts**: Each microservice represents a bounded context (competitions, events, scores, users)
- **Domain Models**: Use rich domain models within each service (Event, Competition, Score entities)
- **Aggregates**: Design aggregates with clear boundaries (Event aggregate includes categories, WODs)
- **Domain Services**: Implement domain logic in domain services, not in entities
- **Repository Pattern**: Abstract data access through repositories (DynamoDB repositories)
- **Domain Events**: Use events for cross-context communication (EventBridge integration)
- **Context Isolation**: NEVER access tables outside your bounded context directly
- **API-First Communication**: Cross-context data access MUST use APIs or EventBridge

### Microservices Design
- **Single Responsibility**: Each service owns one business capability
- **Database per Service**: Each microservice has its own data store (separate DynamoDB tables)
- **API-First Design**: Services communicate only through well-defined APIs
- **Decentralized Governance**: Each team owns their service's technology choices
- **Failure Isolation**: Design for failure - circuit breakers, timeouts, retries
- **Independent Deployment**: Services can be deployed independently via CDK stacks

### Stack Organization
```
infrastructure/
├── shared/              # Cognito, EventBridge, S3
├── competitions/        # Events domain
├── athletes/            # Athletes domain
├── scoring/             # Scoring domain
├── organizations/       # Organizations & RBAC
├── scheduling/          # Scheduling domain
├── categories/          # Categories domain
├── wods/               # WODs domain
└── main-stack.ts       # Orchestrator
```

## Error Handling
- If violating Twelve Factor principles, refactor to use environment variables and stateless design
- If domain boundaries are unclear, consult with domain experts to define proper bounded contexts
- If services are tightly coupled, introduce event-driven communication patterns
- If deployment dependencies exist between services, redesign for independent deployability
