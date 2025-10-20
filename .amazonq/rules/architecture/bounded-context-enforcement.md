# Bounded Context Enforcement

## Purpose
Enforces Domain-Driven Design (DDD) bounded context principles to prevent cross-domain violations and maintain clean microservices architecture in the ScorinGames platform.

## Priority
**Critical** - Must be followed without exception

## Instructions

### Bounded Context Boundaries
- **Competitions Domain**: Events, competitions, event days, event images
- **Athletes Domain**: Athlete profiles, athlete registrations, athlete events
- **Scoring Domain**: Scores, leaderboards, score calculations
- **Organizations Domain**: Organizations, organization members, organization events
- **Scheduling Domain**: Schedules, heats, sessions, classification filters
- **Categories Domain**: Competition categories, category management
- **WODs Domain**: Workouts, WOD management, WOD sharing
- **Sessions Domain**: User sessions, session management

### Strict Rules
- Lambda functions MUST only access tables within their bounded context
- Cross-context data access MUST use EventBridge or API calls, never direct table access
- Each Lambda MUST have a single responsibility within one domain
- Database tables MUST belong to exactly one bounded context
- Shared data MUST be accessed through domain APIs, not direct database queries

### Allowed Cross-Context Access
- **Read-only authorization checks**: Organization membership verification
- **Event-driven communication**: EventBridge for async operations
- **Aggregation services**: Scheduler can read from multiple domains for schedule generation
- **Reporting services**: Analytics can read across domains for insights

### Violation Examples
❌ CompetitionsLambda writing to ATHLETES_TABLE
❌ AthletesLambda reading SCORES_TABLE directly
❌ CategoriesLambda accessing ORGANIZATIONS_TABLE
❌ Any Lambda bypassing domain APIs for cross-context data

### Correct Patterns
✅ CompetitionsLambda → EventBridge → AthletesLambda (for athlete notifications)
✅ ScoresLambda → EventBridge → LeaderboardCalculator (for score updates)
✅ SchedulerLambda reading multiple tables (aggregation service)
✅ OrganizationMembersTable read access for authorization (security boundary)

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
