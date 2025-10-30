# ScorinGames - Calisthenics Competition Management Platform

## Architecture Overview

Multi-tenant competition management platform with role-based access control (RBAC) supporting organizations, organizers, and athletes.

### User Roles

1. **Super Admin** (`admin@athleon.fitness`)
   - Full system access
   - Can view all organizations and events
   - Bypass organization membership checks

2. **Organization Roles**
   - **Owner**: Full organization control, manage members, events
   - **Admin**: Manage members and events
   - **Member**: Create and edit events

3. **Athletes**
   - Register for published events
   - Submit scores
   - View leaderboards
   - Manage profile

## Data Model

### Core Tables

#### 1. **EventsTable**
- **PK**: `eventId`
- **Attributes**: name, description, startDate, endDate, location, status, published, imageUrl
- **GSI**: `status-index` (status, startDate)
- **Purpose**: Master event data

#### 2. **OrganizationsTable**
- **PK**: `organizationId`
- **Attributes**: name, description, settings, createdAt, createdBy
- **Purpose**: Organization/team entities

#### 3. **OrganizationMembersTable** (Many-to-Many)
- **PK**: `organizationId`
- **SK**: `userId`
- **GSI**: `user-organizations-index` (userId, organizationId)
- **Attributes**: role (owner/admin/member), joinedAt, invitedBy
- **Purpose**: User membership in organizations with roles

#### 4. **OrganizationEventsTable** (Many-to-Many)
- **PK**: `organizationId`
- **SK**: `eventId`
- **GSI**: `event-organization-index` (eventId)
- **Attributes**: createdAt, createdBy
- **Purpose**: Link events to organizations

#### 5. **AthleteEventsTable** (Many-to-Many)
- **PK**: `userId` (athleteId)
- **SK**: `eventId`
- **GSI**: `event-athletes-index` (eventId, registeredAt)
- **Attributes**: categoryId, registrationDate, status
- **Purpose**: Athlete registrations for events

#### 6. **AthletesTable**
- **PK**: `userId`
- **Attributes**: firstName, lastName, email, categoryId, dateOfBirth, gender, country
- **Purpose**: Athlete profiles

#### 7. **CategoriesTable** (Event-scoped)
- **PK**: `eventId`
- **SK**: `categoryId`
- **Attributes**: name, description, minAge, maxAge, gender
- **Purpose**: Competition categories per event

#### 8. **WodsTable** (Event-scoped)
- **PK**: `eventId`
- **SK**: `wodId`
- **Attributes**: name, description, type, timeCap, scoringType
- **Purpose**: Workouts/challenges per event

#### 9. **ScoresTable** (Event-scoped)
- **PK**: `eventId`
- **SK**: `scoreId`
- **GSI**: `athlete-scores-index` (athleteId, eventId)
- **Attributes**: athleteId, wodId, categoryId, score, submittedAt, judgeId
- **Purpose**: Athlete performance scores

#### 10. **EventDaysTable** (Event-scoped)
- **PK**: `eventId`
- **SK**: `dayId`
- **Attributes**: date, name, description
- **Purpose**: Multi-day event sessions

### Legacy Tables (Preserved for rollback)

#### 11. **OrganizerEventsTable**
- **PK**: `userId`
- **SK**: `eventId`
- **GSI**: `event-organizers-index` (eventId, userId)
- **Purpose**: Legacy organizer-event links (pre-organizations)

## API Endpoints

### Public Endpoints (No Auth Required)

```
GET /public/events
- Returns all published events
- Used by: Athlete event browsing

GET /public/events/{eventId}
- Returns single published event
- Used by: Public event details page
```

### Organization Endpoints (Auth Required)

```
GET /organizations
- Returns user's organizations
- Super admin: Returns all organizations

POST /organizations
- Create new organization
- Body: { name, description }
- Creator becomes owner

PUT /organizations/{organizationId}
- Update organization
- Requires: owner/admin role

GET /organizations/{organizationId}/members
- List organization members
- Requires: organization membership

POST /organizations/{organizationId}/members
- Add member to organization
- Body: { userId, role }
- Requires: owner/admin role

PUT /organizations/{organizationId}/members/{userId}
- Update member role
- Requires: owner role

DELETE /organizations/{organizationId}/members/{userId}
- Remove member
- Requires: owner/admin role
```

### Competition Endpoints (Auth Required)

```
GET /competitions?organizationId={id}
- List events for organization
- organizationId='all': Super admin sees all events
- Requires: organization membership

POST /competitions
- Create event
- Body: { name, description, startDate, endDate, location, organizationId }
- Links event to organization
- Requires: organization membership (owner/admin/member)

PUT /competitions/{eventId}
- Update event
- Checks organization membership via OrganizationEventsTable
- Super admin: Can update legacy events without organization
- Filters empty strings from updates

DELETE /competitions/{eventId}
- Delete event
- Requires: organization membership

POST /competitions/{eventId}/upload-url
- Generate S3 presigned URL for banner image
- Body: { fileName, fileType }
- Returns: { uploadUrl, imageUrl }
- Expires: 5 minutes

POST /competitions/{eventId}/scores
- Submit score
- Body: { athleteId, wodId, categoryId, score }
- Returns: { scoreId }

GET /competitions/{eventId}/days
- List event days

POST /competitions/{eventId}/days
- Create event day

GET /competitions/{eventId}/categories
- List event categories

POST /competitions/{eventId}/categories
- Create category

GET /competitions/{eventId}/wods
- List event WODs

POST /competitions/{eventId}/wods
- Create WOD
```

### Athlete Endpoints (Auth Required)

```
GET /athletes
- List all athletes
- Used by: Organizers for athlete selection

GET /athletes/{athleteId}
- Get athlete profile

POST /athletes
- Create athlete profile
- Body: { firstName, lastName, email, categoryId, dateOfBirth, gender, country }

PUT /athletes/{athleteId}
- Update athlete profile

POST /athletes/{athleteId}/competitions
- Register athlete for event
- Body: { eventId, categoryId }
- Creates entry in AthleteEventsTable

GET /athletes/{athleteId}/competitions
- Get athlete's registered events
- Returns: Array of { userId, eventId, categoryId, registrationDate, status }
```

### Score Endpoints

```
GET /scores?eventId={id}
- Get all scores for event

GET /scores?eventId={id}&athleteId={id}
- Get athlete's scores for event

POST /scores
- Submit score (alternative endpoint)
```

## Authorization Flow

### Organization-Based Authorization

1. **Check Super Admin**
   ```javascript
   const isSuperAdmin = userEmail === 'admin@scoringames.com';
   if (isSuperAdmin) return { hasAccess: true, role: 'super_admin' };
   ```

2. **Check Organization Membership**
   ```javascript
   const { Item } = await ddb.send(new GetCommand({
     TableName: ORGANIZATION_MEMBERS_TABLE,
     Key: { organizationId, userId }
   }));
   return { hasAccess: !!Item, role: Item?.role };
   ```

3. **Get Event Organization**
   ```javascript
   const { Items } = await ddb.send(new QueryCommand({
     TableName: ORGANIZATION_EVENTS_TABLE,
     IndexName: 'event-organization-index',
     KeyConditionExpression: 'eventId = :eventId'
   }));
   return Items?.[0]?.organizationId;
   ```

### Role Permissions

| Action | Owner | Admin | Member | Athlete |
|--------|-------|-------|--------|---------|
| Create Organization | ✅ | ✅ | ✅ | ❌ |
| Update Organization | ✅ | ✅ | ❌ | ❌ |
| Add Members | ✅ | ✅ | ❌ | ❌ |
| Remove Members | ✅ | ✅ | ❌ | ❌ |
| Change Roles | ✅ | ❌ | ❌ | ❌ |
| Create Events | ✅ | ✅ | ✅ | ❌ |
| Update Events | ✅ | ✅ | ✅ | ❌ |
| Delete Events | ✅ | ✅ | ✅ | ❌ |
| Register for Events | ❌ | ❌ | ❌ | ✅ |
| Submit Scores | ❌ | ❌ | ❌ | ✅ |

## Frontend Architecture

### Context Providers

#### OrganizationContext
- Manages selected organization state
- Persists to localStorage
- Provides organization list and selection
- Special handling for super admin "All Organizations" view

```javascript
const { 
  organizations,           // User's organizations
  selectedOrganization,    // Currently selected org
  selectOrganization,      // Change selected org
  createOrganization       // Create new org
} = useOrganization();
```

### Component Structure

#### Backoffice (Organizers)
- **OrganizationSelector**: Dropdown to switch organizations
- **EventManagement**: CRUD events for selected organization
- **EventDetails**: Edit event, upload banner, manage days/categories/WODs
- **AthleteManagement**: View registered athletes
- **ScoreManagement**: View/edit scores
- **Leaderboard**: View rankings
- **Analytics**: Event statistics

#### Athlete Portal
- **Events**: Browse all published events (uses `/public/events`)
- **AthleteProfile**: 
  - View/edit profile
  - **My Registered Competitions** tab: Shows events from AthleteEventsTable
  - **All Events** tab: Browse and register for events
- **AthleteLeaderboard**: View rankings for registered events
- **ScoreEntry**: Submit scores

### Key Frontend Patterns

1. **Organization-Scoped API Calls**
   ```javascript
   const { selectedOrganization } = useOrganization();
   
   const response = await API.get('CalisthenicsAPI', '/competitions', {
     queryStringParameters: { 
       organizationId: selectedOrganization.organizationId 
     }
   });
   ```

2. **Public Event Access**
   ```javascript
   // Athletes see all published events
   const response = await API.get('CalisthenicsAPI', '/public/events');
   ```

3. **Athlete Registrations**
   ```javascript
   // Get athlete's registered events
   const registrations = await API.get(
     'CalisthenicsAPI', 
     `/athletes/${userId}/competitions`
   );
   
   // Register for event
   await API.post(
     'CalisthenicsAPI',
     `/athletes/${userId}/competitions`,
     { body: { eventId, categoryId } }
   );
   ```

## Migration Strategy

### From Legacy to Organizations

The system migrated from individual organizers to multi-organization teams:

1. **Preserved Legacy Data**
   - OrganizerEventsTable kept for rollback
   - Legacy events without organizationId supported

2. **Migration Script** (`scripts/migrate-to-organizations.js`)
   - Scanned OrganizerEventsTable
   - Created organization per organizer
   - Added organizer as owner
   - Linked events to OrganizationEventsTable

3. **Backward Compatibility**
   - Super admin can update legacy events
   - GetCommand returns null for missing organization links
   - Conditional authorization prevents 404 errors

## Security Considerations

1. **JWT Token Caching**
   - Adding user to organization requires logout/login
   - Cognito token doesn't auto-refresh
   - Hard refresh doesn't update authentication

2. **Presigned URLs**
   - 5-minute expiration for S3 uploads
   - Backend generates with IAM credentials
   - Frontend uploads directly without exposing keys

3. **RBAC Enforcement**
   - Every endpoint checks organization membership
   - Role verified at operation level
   - Super admin bypass for system operations

4. **Data Isolation**
   - Events scoped to organizations
   - Athletes can only see published events
   - Scores visible only to event organization and athlete

## Deployment

### Backend (CDK)
```bash
cd /home/labvel/projects/scoringames
cdk deploy --profile labvel-dev
```

### Frontend
```bash
cd frontend
npm run build
aws s3 sync build/ s3://calisthenics-app-571340586587 --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id E1MZ3OMBI2NDM3 --paths "/*" --profile labvel-dev
```

## Environment Variables

### Lambda Functions
- `EVENTS_TABLE`: EventsTable name
- `ORGANIZATIONS_TABLE`: OrganizationsTable name
- `ORGANIZATION_MEMBERS_TABLE`: OrganizationMembersTable name
- `ORGANIZATION_EVENTS_TABLE`: OrganizationEventsTable name
- `ORGANIZER_EVENTS_TABLE`: OrganizerEventsTable name (legacy)
- `ATHLETE_EVENTS_TABLE`: AthleteEventsTable name
- `ATHLETES_TABLE`: AthletesTable name
- `CATEGORIES_TABLE`: CategoriesTable name
- `WODS_TABLE`: WodsTable name
- `SCORES_TABLE`: ScoresTable name
- `EVENT_DAYS_TABLE`: EventDaysTable name
- `EVENT_IMAGES_BUCKET`: S3 bucket for event banners

### Frontend (aws-exports.js)
- API Gateway endpoint
- Cognito User Pool ID
- Cognito App Client ID
- S3 bucket for images

## Common Issues

### 1. "Request failed with status code 400" on /competitions
**Cause**: Missing `organizationId` query parameter  
**Fix**: Add organization context to component

### 2. Athletes see no events
**Cause**: Using `/competitions` instead of `/public/events`  
**Fix**: Athletes should use public endpoint

### 3. No registered competitions showing
**Cause**: AthleteEventsTable not populated  
**Fix**: Ensure registration flow uses `/athletes/{id}/competitions` POST

### 4. Permission denied after adding to organization
**Cause**: JWT token not refreshed  
**Fix**: Logout and login to refresh Cognito token

### 5. Image upload fails
**Cause**: Missing S3 permissions  
**Fix**: Ensure `eventImagesBucket.grantPut(competitionsLambda)`

## Testing Accounts

- **Super Admin**: admin@athleon.fitness
- **Organizer 1**: organizer1@test.com (owner of "organizer1's Organization")
- **Organizer 2**: organizer2@test.com (owner of "organizer2's Organization")
- **Admin User**: avelez@labvel.io (admin of "organizer1's Organization")
- **Athlete**: athlete1@test.com

## Future Enhancements

1. Email invitations for organization members
2. Event templates
3. Bulk score import
4. Real-time leaderboard updates
5. Mobile app
6. Payment integration for event registration
7. Judge assignment and scoring workflow
8. Event cloning
9. Multi-language support
10. Advanced analytics and reporting
