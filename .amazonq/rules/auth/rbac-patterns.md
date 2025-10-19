# Authentication & Authorization Patterns

## User Roles
- **Super Admin**: `admin@scoringames.com` - Platform-wide access
- **Organization Owner**: Full organization control, manage members, events
- **Organization Admin**: Manage members and events
- **Organization Member**: Create and edit events
- **Athletes**: Register for events, submit scores, view leaderboards

## Authentication
- Use Cognito User Pool for authentication
- JWT tokens with custom attributes
- Check super admin: `userEmail === 'admin@scoringames.com'`

## Authorization Flow
1. Check super admin status first
2. Check organization membership via OrganizationMembersTable
3. Verify role permissions for requested action
4. Filter data by organization scope

## Multi-Tenant Security
- All queries filtered by organizationId for tenant isolation
- No cross-tenant data access
- Enforced at Lambda level
