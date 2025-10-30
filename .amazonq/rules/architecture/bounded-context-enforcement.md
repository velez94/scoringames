# Bounded Context Enforcement

## Purpose
Enforces Domain-Driven Design (DDD) bounded context principles to prevent cross-domain violations and maintain clean microservices architecture in the ScorinGames platform.

## Priority
**Critical** - Must be followed without exception

## Instructions

### Bounded Context Boundaries

Each bounded context has its own CDK stack in `infrastructure/` directory:

- **Competitions Domain** (`infrastructure/competitions/`)
  - Tables: EventsTable, EventDaysTable
  - Lambda: competitions.handler
  - Owns: Event lifecycle, event days, event publishing
  
- **Organizations Domain** (`infrastructure/organizations/`)
  - Tables: OrganizationsTable, OrganizationMembersTable, OrganizationEventsTable
  - Lambda: organizations.handler
  - Owns: Organization management, membership, RBAC
  
- **Athletes Domain** (`infrastructure/athletes/`)
  - Tables: AthletesTable, AthleteEventsTable
  - Lambda: athletes.handler
  - Owns: Athlete profiles, event registrations
  
- **Scoring Domain** (`infrastructure/scoring/`)
  - Tables: ScoresTable, ScoringSystemsTable, LeaderboardCacheTable
  - Lambda: scores.handler, leaderboard.handler
  - Owns: Score submission, calculations, leaderboards
  
- **Scheduling Domain** (`infrastructure/scheduling/`)
  - Tables: SchedulesTable, HeatsTable, ClassificationFiltersTable
  - Lambda: scheduler.handler
  - Owns: Schedule generation, heat management
  
- **Categories Domain** (`infrastructure/categories/`)
  - Tables: CategoriesTable
  - Lambda: categories.handler
  - Owns: Category definitions, category management
  
- **WODs Domain** (`infrastructure/wods/`)
  - Tables: WodsTable
  - Lambda: wods.handler
  - Owns: WOD templates, WOD sharing
  
- **Shared Infrastructure** (`infrastructure/shared/`)
  - Resources: Cognito, EventBridge, S3, API Gateway
  - Purpose: Cross-cutting concerns

### Strict Rules
- Lambda functions MUST only access tables within their bounded context
- Cross-context data access MUST use EventBridge or API calls, never direct table access
- Each Lambda MUST have a single responsibility within one domain
- Database tables MUST belong to exactly one bounded context
- Shared data MUST be accessed through domain APIs, not direct database queries
- Each stack MUST be independently deployable

### Allowed Cross-Context Access
- **Read-only authorization checks**: Organization membership verification (via API or EventBridge)
- **Event-driven communication**: EventBridge for async operations
- **Aggregation services**: Scheduler can read from multiple domains via EventBridge queries
- **Reporting services**: Analytics can read across domains via EventBridge

### Violation Examples
❌ CompetitionsLambda writing to ATHLETES_TABLE
❌ AthletesLambda reading SCORES_TABLE directly
❌ CategoriesLambda accessing ORGANIZATIONS_TABLE directly
❌ Any Lambda bypassing domain APIs for cross-context data
❌ Hardcoding table names from other domains

### Correct Patterns
✅ CompetitionsLambda → EventBridge → AthletesLambda (for athlete notifications)
✅ ScoresLambda → EventBridge → LeaderboardCalculator (for score updates)
✅ SchedulerLambda → EventBridge query → Multiple domains (aggregation service)
✅ OrganizationMembersTable read access via Organizations API (authorization boundary)

### Stack Dependencies
- Shared Stack → No dependencies
- Network Stack → Depends on Shared Stack (Cognito)
- Domain Stacks → Depend on Shared Stack (EventBridge) and Network Stack (API Gateway)
- Organizations Stack → Must be deployed before Competitions Stack (RBAC dependency)

## Error Handling
- If cross-context access is needed, implement EventBridge communication
- If direct access seems necessary, reconsider the domain boundaries
- If aggregation is required, create a dedicated aggregation service
- If authorization is needed, use read-only access to organization tables only

## Enforcement
- Review all Lambda environment variables for table access
- Ensure IAM permissions match bounded context boundaries
- Verify EventBridge is used for cross-context communication
- Check that each service has clear domain responsibility
