# Bounded Context API Design

## Purpose
Ensures API endpoints respect bounded context boundaries and prevent cross-domain violations in the ScorinGames platform.

## Priority
**Critical** - Must be followed without exception

## Instructions

### API Endpoint Mapping
- `/competitions/*` → CompetitionsLambda → Competitions Domain
- `/organizations/*` → OrganizationsLambda → Organizations Domain  
- `/athletes/*` → UsersLambda → Athletes Domain
- `/scores/*` → ScoresLambda → Scoring Domain
- `/categories/*` → CategoriesLambda → Categories Domain
- `/wods/*` → WodsLambda → WODs Domain
- `/sessions/*` → SessionsLambda → Sessions Domain
- `/scheduler/*` → SchedulerLambda → Scheduling Domain (aggregation service)

### Cross-Context Data Rules
- NEVER create endpoints that span multiple domains
- Use EventBridge for cross-context notifications
- Aggregation services (scheduler) can read from multiple domains
- Authorization checks can read organization tables

### Violation Examples
❌ `/competitions/{id}/athletes` accessing ATHLETES_TABLE directly
❌ `/athletes/{id}/scores` accessing SCORES_TABLE directly
❌ Any endpoint mixing domain responsibilities

### Correct Patterns
✅ `/competitions/{id}/schedule` (scheduler aggregates data)
✅ EventBridge events for cross-domain updates
✅ Separate API calls for cross-domain data
✅ Read-only organization access for authorization

## Error Handling
- If cross-domain data is needed, use separate API calls
- If real-time updates are needed, implement EventBridge
- If aggregation is required, create dedicated aggregation endpoints
- If authorization is needed, use organization membership checks only
