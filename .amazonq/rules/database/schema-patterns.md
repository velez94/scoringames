# Database Schema Patterns

## Multi-Tenant Tables
- EventsTable: PK=eventId, published field for public access
- OrganizationsTable: PK=organizationId for multi-tenant support
- OrganizationMembersTable: PK=organizationId, SK=userId for RBAC
- OrganizationEventsTable: PK=organizationId, SK=eventId for event ownership
- AthleteEventsTable: PK=userId, SK=eventId for athlete registrations
- ScoresTable: PK=eventId, SK=scoreId for competition scores

## Naming Conventions
- Use camelCase for all attributes
- Use consistent key patterns: PK/SK for composite keys
- Include GSI for reverse lookups where needed

## Data Patterns
- Always filter by organizationId for tenant isolation
- Use published=true for public event access
- Include createdAt/updatedAt timestamps
- Deduplicate data when returning from APIs (e.g., categories by categoryId)
