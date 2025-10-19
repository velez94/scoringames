# Event Management Business Rules

## Event Lifecycle States

### State Transitions
```
Draft → Published → Active → Completed
  ↓        ↓         ↓        ↓
Delete   Register  Compete  Archive
```

### State Definitions
- **Draft**: Event being created/edited, not visible to athletes
- **Published**: Event visible to athletes, registration open
- **Active**: Event in progress, scores being submitted
- **Completed**: Event finished, final results available

## Publishing Rules

### Pre-Publication Validation
1. **Required Fields**: Name, description, dates, location must be set
2. **Categories**: At least one category must be assigned
3. **WODs**: At least one WOD must be assigned
4. **Organization**: Event must belong to an organization
5. **Dates**: Start date must be in the future

### Publication Effects
1. **Athlete Visibility**: Event appears in public events list
2. **Registration Opens**: Athletes can register for event
3. **Immutable Fields**: Core event data becomes read-only
4. **Deletion Protection**: Published events cannot be deleted

## Registration Management

### Registration Rules
1. **Event Status**: Only published events accept registrations
2. **Category Selection**: Athletes must select valid category
3. **Capacity Limits**: Respect maxParticipants if set
4. **Duplicate Prevention**: One registration per athlete per event
5. **Registration Window**: Must be within event date range

### Registration Data
```javascript
{
  userId: "athlete-id",
  eventId: "event-id", 
  categoryId: "category-id",
  registrationDate: "ISO-8601-timestamp",
  status: "registered" | "cancelled" | "completed"
}
```

### Organizer Registration Powers
- **Backoffice Registration**: Organizers can register athletes directly
- **Category Assignment**: Can assign athletes to any event category
- **Bulk Registration**: Can register multiple athletes at once
- **Registration Override**: Can register even if capacity reached

## Category Management

### Category Assignment Rules
1. **Global Categories**: Available across all events
2. **Event-Specific**: Categories created for specific events
3. **Flexible Assignment**: Organizers choose which categories apply
4. **Registration Requirement**: Athletes must select from assigned categories

### Category Data Structure
```javascript
{
  eventId: "event-id" | "global",
  categoryId: "category-id",
  name: "RX Male",
  description: "Elite male division",
  minAge: 18,
  maxAge: null,
  gender: "male" | "female" | "mixed"
}
```

## WOD Management

### WOD Assignment Rules
1. **Template WODs**: Reusable across multiple events
2. **Event-Specific**: WODs created for specific events  
3. **Flexible Selection**: Organizers choose which WODs to include
4. **Score Dependencies**: WODs with scores cannot be removed

### WOD Data Structure
```javascript
{
  eventId: "event-id" | "template",
  wodId: "wod-id",
  name: "Fran",
  description: "21-15-9 Thrusters and Pull-ups",
  format: "time" | "reps" | "weight",
  timeCap: 600, // seconds
  movements: [...]
}
```

## Score Management

### Score Submission Rules
1. **Event Status**: Only published/active events accept scores
2. **Registration Required**: Athlete must be registered for event
3. **Category Validation**: Score must match registration category
4. **WOD Validation**: WOD must be assigned to event
5. **Judge Validation**: Scores may require judge approval

### Score Data Structure
```javascript
{
  eventId: "event-id",
  scoreId: "score-id",
  athleteId: "athlete-id",
  wodId: "wod-id", 
  categoryId: "category-id",
  score: 150, // time in seconds, reps, or weight
  submittedAt: "ISO-8601-timestamp",
  judgeId: "judge-id", // optional
  rank: 1 // calculated field
}
```

## Deletion Protection

### Protected Events
- **Published Events**: Cannot be deleted
- **Events with Scores**: Cannot be deleted
- **Active Events**: Cannot be deleted

### Safe Deletion Process
1. **Status Check**: Verify event is in draft state
2. **Registration Cleanup**: Remove all athlete registrations
3. **Organization Validation**: Verify user has permission
4. **Cascade Cleanup**: Remove associated data
5. **Audit Log**: Record deletion event

### Deletion Permissions
- **Organization Members**: Can delete their organization's draft events
- **Super Admin**: Can delete any event including published ones
- **Athletes**: Cannot delete events

## Event Editing Rules

### Always Editable Fields
- **Description**: Can be updated anytime
- **Location**: Can be updated anytime  
- **End Date**: Can be extended anytime
- **Max Participants**: Can be increased anytime

### Restricted Fields (Published Events)
- **Name**: Requires admin approval
- **Start Date**: Cannot move to past
- **Categories**: Cannot remove if athletes registered
- **WODs**: Cannot remove if scores exist

### Immutable Fields (Published Events)
- **Event ID**: Never changes
- **Organization**: Cannot transfer ownership
- **Creation Date**: Historical record

## Organization Integration

### Organization Ownership
- **Event Creation**: Must specify organization
- **Access Control**: Only organization members can edit
- **Multi-Organization**: Events belong to single organization
- **Legacy Support**: Super admin can edit orphaned events

### Member Permissions
- **Owner/Admin/Member**: Full event management rights
- **Role Changes**: Permissions update with role changes
- **Organization Transfer**: Not supported (would break ownership)

## Audit and Compliance

### Change Tracking
- **Event Updates**: Log all field changes
- **Registration Changes**: Track athlete additions/removals
- **Score Updates**: Log all score modifications
- **Permission Changes**: Track access control updates

### Data Retention
- **Completed Events**: Retain indefinitely for historical records
- **Draft Events**: Can be deleted after 30 days inactive
- **Audit Logs**: Retain for 7 years for compliance
- **Personal Data**: Follow GDPR deletion requirements
