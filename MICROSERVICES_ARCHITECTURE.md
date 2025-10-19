# Microservices Architecture - Multi-Tenant Platform

## ✅ Deployment Complete

**Stack Status:** Deployed successfully  
**API URL:** https://5p9ja0yat5.execute-api.us-east-2.amazonaws.com/prod/  
**Super Admin:** admin@scoringames.com / Admin123!

## Architecture Overview

### Microservices Pattern

Instead of a monolithic Lambda, the application uses **6 independent microservices**, each responsible for a specific domain:

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                  (Cognito Authorizer)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐    ┌───▼────┐    ┌───▼────┐
   │Competi- │    │Events  │    │Scores  │
   │tions    │    │Service │    │Service │
   │Service  │    └────────┘    └────┬───┘
   └─────────┘                       │
        │                            │ EventBridge
   ┌────▼────┐    ┌────────┐    ┌───▼────────┐
   │Catego-  │    │WODs    │    │Leaderboard │
   │ries     │    │Service │    │Calculator  │
   │Service  │    └────────┘    └────────────┘
   └─────────┘
        │
   ┌────▼────┐
   │Users    │
   │Service  │
   └─────────┘
```

### Benefits

1. **No Lambda Policy Limit** - Each service has its own permissions
2. **Independent Scaling** - Services scale based on their own traffic
3. **Isolated Failures** - One service failure doesn't affect others
4. **Team Autonomy** - Different teams can own different services
5. **Faster Deployments** - Deploy only changed services
6. **Clear Boundaries** - Each service has single responsibility

## Microservices

### 1. Competitions Service
**Path:** `/competitions/*`  
**Lambda:** CompetitionsLambda  
**Responsibilities:**
- Create/list/update/delete competitions
- Manage organizers (add/remove)
- Handle athlete registrations
- Competition metadata

**Tables:**
- competitions
- organizer-competitions
- athlete-competitions

### 2. Events Service
**Path:** `/events/*`  
**Lambda:** EventsLambda  
**Responsibilities:**
- Create/list/update/delete events
- Upload event images
- Event scheduling

**Tables:**
- events

**Resources:**
- S3 bucket (event images)

### 3. Scores Service
**Path:** `/scores/*`  
**Lambda:** ScoresLambda  
**Responsibilities:**
- Submit/update/delete scores
- Query scores by event/athlete
- Trigger leaderboard calculations
- Generate leaderboards

**Tables:**
- scores
- athletes (read-only)

**Integrations:**
- EventBridge (publish score events)

### 4. Categories Service
**Path:** `/categories/*`  
**Lambda:** CategoriesLambda  
**Responsibilities:**
- Create/list/update/delete categories
- Category management per competition

**Tables:**
- categories

### 5. WODs Service
**Path:** `/wods/*`  
**Lambda:** WodsLambda  
**Responsibilities:**
- Create/list/update/delete WODs
- WOD templates
- WOD assignments to events

**Tables:**
- wods

### 6. Users Service
**Path:** `/me/*` and `/users/*`  
**Lambda:** UsersLambda  
**Responsibilities:**
- User profile management
- List user's competitions
- Admin user management

**Tables:**
- athletes
- athlete-competitions (read-only)

### 7. Leaderboard Calculator (Event-Driven)
**Trigger:** EventBridge  
**Lambda:** LeaderboardCalculator  
**Responsibilities:**
- Async leaderboard calculations
- Ranking updates
- Performance metrics

**Tables:**
- scores (read-only)
- athletes (read-only)
- competitions (read-only)

## API Routes

### Proxy Integration

Each microservice uses `{proxy+}` pattern:

```
/competitions     → CompetitionsLambda
/competitions/*   → CompetitionsLambda

/events           → EventsLambda
/events/*         → EventsLambda

/scores           → ScoresLambda
/scores/*         → ScoresLambda

/categories       → CategoriesLambda
/categories/*     → CategoriesLambda

/wods             → WodsLambda
/wods/*           → WodsLambda

/me               → UsersLambda
/me/*             → UsersLambda

/users            → UsersLambda
/users/*          → UsersLambda
```

### Route Handling

Each Lambda receives:
- `event.path` - Full path (e.g., `/competitions/123/organizers`)
- `event.httpMethod` - HTTP method (GET, POST, PUT, DELETE)
- `event.requestContext.authorizer.claims` - Cognito user info

Example routing in Lambda:

```javascript
exports.handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;
  
  if (path === '/competitions' && method === 'GET') {
    return listCompetitions();
  }
  
  if (path.match(/^\/competitions\/[^/]+$/) && method === 'GET') {
    const competitionId = path.split('/')[2];
    return getCompetition(competitionId);
  }
  
  // ... more routes
};
```

## Data Model

### Multi-Tenant Tables

All tables use `competitionId` as partition key for tenant isolation:

```
competitions
  PK: competitionId
  Attributes: name, startDate, endDate, status, createdBy

organizer-competitions
  PK: userId
  SK: competitionId
  GSI: competitionId + userId (reverse lookup)

athlete-competitions
  PK: userId
  SK: competitionId
  GSI: competitionId + registeredAt

events
  PK: competitionId
  SK: eventId

categories
  PK: competitionId
  SK: categoryId

wods
  PK: competitionId
  SK: wodId

scores
  PK: competitionId
  SK: scoreId (format: eventId#athleteId)
  GSI: eventId + score

athletes
  PK: userId (global, not tenant-scoped)
```

## Implementation Status

### ✅ Complete
- Infrastructure (CDK)
- DynamoDB tables
- Lambda functions (skeleton)
- API Gateway routing
- Cognito authentication
- EventBridge integration
- Super admin creation

### ⚠️ TODO
- Implement business logic in each microservice
- Add authorization middleware
- Implement competition CRUD
- Implement organizer management
- Implement athlete registration
- Implement events CRUD
- Implement scores submission
- Implement leaderboard calculation
- Update frontend for new API structure

## Development Workflow

### 1. Implement a Microservice

```bash
# Edit the Lambda handler
vim lambda/competitions.js

# Deploy only if CDK changes needed
npm run build
cdk deploy

# Or just update Lambda code
cd lambda
zip -r competitions.zip competitions.js node_modules
aws lambda update-function-code \
  --function-name CalisthenicsAppStack-CompetitionsLambda \
  --zip-file fileb://competitions.zip
```

### 2. Test a Microservice

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test endpoint
curl $API_URL/competitions
```

### 3. Monitor a Microservice

```bash
# View logs
aws logs tail /aws/lambda/CalisthenicsAppStack-CompetitionsLambda --follow

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=CalisthenicsAppStack-CompetitionsLambda \
  --start-time 2025-10-15T00:00:00Z \
  --end-time 2025-10-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Cost Optimization

### Per-Service Scaling
- Each Lambda scales independently
- Only pay for what each service uses
- No wasted capacity

### Right-Sized Memory
- All services: 256MB (sufficient for CRUD)
- Leaderboard calculator: 512MB (computation-heavy)

### On-Demand DynamoDB
- Pay per request
- No provisioned capacity waste
- Auto-scales with traffic

### Estimated Costs (10 competitions, 1000 users)
- Lambda: ~$5/month
- DynamoDB: ~$10/month
- API Gateway: ~$3/month
- S3: ~$1/month
- CloudFront: ~$1/month
- **Total: ~$20/month**

## Security

### Authentication
- Cognito User Pool
- JWT tokens
- Custom attribute: `isSuperAdmin`

### Authorization (To Implement)
- Super admin: Platform-wide access
- Organizer: Competition-scoped access
- Athlete: Read-only + self-registration

### Tenant Isolation
- All queries filtered by `competitionId`
- No cross-tenant data access
- Enforced at Lambda level

## Next Steps

1. **Implement Competitions Service** (highest priority)
   - Create competition
   - List competitions
   - Add organizers
   - Athlete registration

2. **Implement Authorization Middleware**
   - Check super admin
   - Check organizer access
   - Check athlete registration

3. **Implement Events Service**
   - CRUD operations
   - Image upload

4. **Implement Scores Service**
   - Score submission
   - Leaderboard generation

5. **Update Frontend**
   - New API endpoints
   - Competition selector
   - Multi-tenant UI

See `MIGRATION_CHECKLIST.md` for detailed implementation tasks.
