# Multi-Tenant Quick Start Guide

## Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Build & Deploy
```bash
npm run build
npm run deploy
```

### 3. Create Super Admin
```bash
npm run create-admin -- --email=admin@example.com --password=SecurePass123! --profile=labvel-dev
```

## Common Operations

### Create Competition (Super Admin)
```bash
POST /competitions
Authorization: Bearer <super-admin-token>

{
  "name": "Summer Games 2025",
  "startDate": "2025-06-01T00:00:00Z",
  "endDate": "2025-06-03T23:59:59Z",
  "status": "upcoming",
  "description": "Annual summer competition"
}
```

### Assign Organizer (Super Admin)
```bash
POST /competitions/{competitionId}/organizers
Authorization: Bearer <super-admin-token>

{
  "userId": "user-cognito-sub",
  "email": "organizer@example.com",
  "role": "admin",
  "permissions": ["manage_events", "manage_scores", "manage_athletes"]
}
```

### Register Athlete (Self-Service)
```bash
POST /competitions/{competitionId}/register
Authorization: Bearer <athlete-token>

{
  "categoryId": "rx-male",
  "division": "Open"
}
```

### Create Event (Organizer)
```bash
POST /competitions/{competitionId}/events
Authorization: Bearer <organizer-token>

{
  "name": "WOD 1",
  "description": "21-15-9 Thrusters and Pull-ups",
  "date": "2025-06-01T10:00:00Z",
  "categoryId": "rx-male"
}
```

### Submit Score (Organizer)
```bash
POST /competitions/{competitionId}/scores
Authorization: Bearer <organizer-token>

{
  "eventId": "event-123",
  "athleteId": "user-456",
  "score": 285,
  "scoreType": "time",
  "notes": "Completed as prescribed"
}
```

### View Leaderboard (Public)
```bash
GET /competitions/{competitionId}/scores/leaderboard?categoryId=rx-male
```

### Get My Profile (Authenticated)
```bash
GET /me
Authorization: Bearer <user-token>
```

### Update My Profile (Authenticated)
```bash
PUT /me
Authorization: Bearer <user-token>

{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

### List My Competitions (Authenticated)
```bash
GET /me/competitions
Authorization: Bearer <user-token>

Response:
{
  "asAthlete": [
    {
      "competitionId": "comp-123",
      "name": "Summer Games 2025",
      "status": "active",
      "registeredAt": "2025-05-01T12:00:00Z"
    }
  ],
  "asOrganizer": [
    {
      "competitionId": "comp-456",
      "name": "Winter Challenge 2025",
      "role": "admin",
      "assignedAt": "2025-04-15T09:00:00Z"
    }
  ]
}
```

### List Users (Admin)
```bash
GET /users
Authorization: Bearer <admin-token>
```

### Get User by ID (Admin)
```bash
GET /users/{userId}
Authorization: Bearer <admin-token>
```

## Authorization Matrix

| Role | Create Competition | Manage Organizers | Create Events | Submit Scores | Register as Athlete | View Leaderboard |
|------|-------------------|-------------------|---------------|---------------|---------------------|------------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Organizer | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Athlete | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Public | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Data Model Quick Reference

### Competition
```json
{
  "competitionId": "uuid",
  "name": "string",
  "startDate": "ISO8601",
  "endDate": "ISO8601",
  "status": "upcoming|active|completed",
  "description": "string",
  "createdBy": "userId",
  "createdAt": "ISO8601"
}
```

### Organizer-Competition Mapping
```json
{
  "userId": "cognito-sub",
  "competitionId": "uuid",
  "role": "owner|admin|judge",
  "permissions": ["string"],
  "assignedAt": "ISO8601",
  "assignedBy": "userId"
}
```

### Athlete-Competition Registration
```json
{
  "userId": "cognito-sub",
  "competitionId": "uuid",
  "categoryId": "string",
  "division": "string",
  "registeredAt": "ISO8601",
  "status": "registered|checked-in|withdrawn"
}
```

### Event (Tenant-Scoped)
```json
{
  "competitionId": "uuid",
  "eventId": "uuid",
  "name": "string",
  "description": "string",
  "date": "ISO8601",
  "categoryId": "string",
  "wodId": "string"
}
```

### Score (Tenant-Scoped)
```json
{
  "competitionId": "uuid",
  "scoreId": "eventId#athleteId",
  "eventId": "uuid",
  "athleteId": "userId",
  "score": "number",
  "scoreType": "time|reps|weight",
  "rank": "number",
  "submittedBy": "userId",
  "submittedAt": "ISO8601"
}
```

## Environment Variables

Lambda functions receive:
- `COMPETITIONS_TABLE`
- `ORGANIZER_COMPETITIONS_TABLE`
- `ATHLETE_COMPETITIONS_TABLE`
- `EVENTS_TABLE`
- `SCORES_TABLE`
- `ATHLETES_TABLE`
- `CATEGORIES_TABLE`
- `WODS_TABLE`
- `USER_POOL_ID`
- `EVENT_IMAGES_BUCKET`

## Troubleshooting

### "User not authorized"
- Check Cognito token is valid
- Verify user has correct role in DynamoDB
- Check competitionId in request matches user's access

### "Competition not found"
- Verify competitionId exists
- Check competition status (may be deleted)

### "Cannot register for competition"
- Competition may be completed
- User may already be registered
- Category may not exist

### "Cannot create event"
- User must be organizer for this competition
- Competition must be in upcoming/active status

## Monitoring

### CloudWatch Logs
```bash
# API Lambda logs
aws logs tail /aws/lambda/CalisthenicsAppStack-ApiLambda --follow

# Leaderboard calculator logs
aws logs tail /aws/lambda/CalisthenicsAppStack-LeaderboardCalculator --follow
```

### DynamoDB Metrics
```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=calisthenics-competitions \
  --start-time 2025-10-15T00:00:00Z \
  --end-time 2025-10-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Next Steps

1. ✅ Infrastructure deployed
2. ⚠️ Update Lambda handlers (see backend implementation guide)
3. ⚠️ Update frontend for new API routes
4. ⚠️ Create super admin dashboard
5. ⚠️ Test end-to-end flows
6. ⚠️ Migrate existing data (if any)

See `MULTI_TENANT_MIGRATION.md` for detailed implementation steps.
