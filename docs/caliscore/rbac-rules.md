# Role-Based Access Control (RBAC) Business Rules

## User Roles Hierarchy

### Super Admin
- **Email**: `admin@scoringames.com`
- **Scope**: System-wide access
- **Permissions**: All operations across all organizations and events

### Organization Roles
- **Owner**: Full organization control
- **Admin**: Manage members and events  
- **Member**: Create and edit events

### Athletes
- **Scope**: Personal profile and event participation
- **Permissions**: Register for events, submit scores, view leaderboards

## Permission Matrix

| Resource | Super Admin | Owner | Admin | Member | Athlete |
|----------|-------------|-------|-------|--------|---------|
| **Organizations** |
| Create Organization | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Organization | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Organization | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Members** |
| Add Members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Remove Members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change Roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Events** |
| Create Events | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Events | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete Events | ✅ | ✅ | ✅ | ✅ | ❌ |
| Publish Events | ✅ | ✅ | ✅ | ✅ | ❌ |
| **WODs** |
| Create WODs | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update WODs | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete WODs | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Categories** |
| Create Categories | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Categories | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete Categories | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Athletes** |
| Register for Events | ❌ | ❌ | ❌ | ❌ | ✅ |
| Submit Scores | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update Profile | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Scores** |
| View All Scores | ✅ | ✅ | ✅ | ✅ | Own Only |
| Edit Scores | ✅ | ✅ | ✅ | ✅ | Own Only |
| Delete Scores | ✅ | ✅ | ✅ | ✅ | Own Only |

## Authorization Flow

### 1. Super Admin Check
```javascript
const isSuperAdmin = userEmail === 'admin@scoringames.com';
if (isSuperAdmin) return { hasAccess: true, role: 'super_admin' };
```

### 2. Organization Membership Check
```javascript
const { Item } = await ddb.send(new GetCommand({
  TableName: ORGANIZATION_MEMBERS_TABLE,
  Key: { organizationId, userId }
}));
return { hasAccess: !!Item, role: Item?.role };
```

### 3. Event Organization Lookup
```javascript
const { Items } = await ddb.send(new QueryCommand({
  TableName: ORGANIZATION_EVENTS_TABLE,
  IndexName: 'event-organization-index',
  KeyConditionExpression: 'eventId = :eventId'
}));
return Items?.[0]?.organizationId;
```

## Implementation Status

### ✅ Implemented Services
- **Competitions**: Full RBAC with organization membership
- **Organizations**: Role-based member management
- **Events**: Organization-scoped access control

### ❌ Missing RBAC Services
- **WODs**: No authorization checks
- **Categories**: No organization validation
- **Scores**: Basic auth only, no role validation
- **Users/Athletes**: No organization context

### 🔄 Partial Implementation
- **Public Endpoints**: Correctly bypass auth for published events
- **Legacy Support**: Super admin can access events without organization

## Security Considerations

### JWT Token Limitations
- **Caching Issue**: Adding user to organization requires logout/login
- **No Auto-Refresh**: Cognito tokens don't update automatically
- **Hard Refresh**: Doesn't update authentication context

### Data Isolation
- **Events**: Scoped to organizations
- **Athletes**: Can only see published events
- **Scores**: Visible to event organization and athlete
- **Organizations**: Members can only see their organizations

## Required Implementations

### High Priority (Security Gaps)
1. **WODs Service**: Add organization-based authorization
2. **Categories Service**: Implement organization validation
3. **Scores Service**: Add role-based access control

### Medium Priority (User Experience)
1. **Token Refresh**: Implement automatic token updates
2. **Role Changes**: Handle real-time role updates
3. **Permission UI**: Show/hide features based on roles

### Low Priority (Audit)
1. **Access Logging**: Track all authorization decisions
2. **Permission Reports**: Admin view of user permissions
3. **Role History**: Track role changes over time
