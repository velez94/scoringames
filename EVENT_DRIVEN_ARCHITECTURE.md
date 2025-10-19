# Event-Driven Architecture Implementation

## Overview

Successfully implemented a complete event-driven architecture for the ScorinGames platform, replacing direct database access with EventBridge-based communication between microservices.

## Architecture Components

### 1. Scheduler Orchestrator
- **Function**: `scheduler-orchestrator.handler`
- **Purpose**: Coordinates schedule generation by requesting data from all domains
- **Communication**: Uses EventBridge to request and collect data from domain services
- **Database Access**: Only to Schedules table (no cross-domain access)

### 2. Domain EventBridge Handlers

#### Events Domain Handler
- **Function**: `events-eventbridge-handler.handler`
- **Responsibilities**: 
  - Provides event data and auto-generated event days
  - Responds to "Event Data Requested" events
- **Tables**: EventsTable, EventDaysTable (read-only)

#### Athletes Domain Handler
- **Function**: `athletes-eventbridge-handler.handler`
- **Responsibilities**:
  - Provides registered athletes for events
  - Responds to "Athletes Data Requested" events
- **Tables**: AthletesTable, AthleteEventsTable (read-only)

#### Categories Domain Handler
- **Function**: `categories-eventbridge-handler.handler`
- **Responsibilities**:
  - Provides event categories
  - Responds to "Categories Data Requested" events
- **Tables**: CategoriesTable (read-only)

#### WODs Domain Handler
- **Function**: `wods-eventbridge-handler.handler`
- **Responsibilities**:
  - Provides event WODs/workouts
  - Responds to "WODs Data Requested" events
- **Tables**: WodsTable (read-only)

## EventBridge Communication Flow

### 1. Schedule Generation Request
```
HTTP POST /scheduler/{eventId}
↓
Scheduler Orchestrator generates requestId
↓
Publishes 4 events to EventBridge:
- Event Data Requested
- Athletes Data Requested  
- Categories Data Requested
- WODs Data Requested
```

### 2. Domain Response Collection
```
Each domain handler:
1. Receives data request event
2. Queries its own database tables
3. Publishes response event back to EventBridge
4. Scheduler orchestrator collects all responses
5. Generates schedule when all data received
```

### 3. EventBridge Rules Configuration

#### Data Request Rules
- **EventDataRequestRule**: Routes "Event Data Requested" → Events Handler
- **AthletesDataRequestRule**: Routes "Athletes Data Requested" → Athletes Handler  
- **CategoriesDataRequestRule**: Routes "Categories Data Requested" → Categories Handler
- **WodsDataRequestRule**: Routes "WODs Data Requested" → WODs Handler

#### Response Collection Rule
- **DomainResponsesRule**: Routes all domain responses → Scheduler Orchestrator
  - Sources: `events.domain`, `athletes.domain`, `categories.domain`, `wods.domain`
  - Detail Types: `*Data Response`, `*Data Error`

## Benefits Achieved

### ✅ Domain Separation
- Each service only accesses its own database tables
- No cross-domain database queries
- Clear bounded contexts per DDD principles

### ✅ Scalability
- Services can be scaled independently
- EventBridge handles message routing and delivery
- Asynchronous processing reduces coupling

### ✅ Fault Tolerance
- Individual domain failures don't crash entire system
- Error events published for failed data requests
- Graceful degradation possible

### ✅ Twelve Factor Compliance
- **Factor VI**: Stateless processes (no shared state)
- **Factor VIII**: Concurrency via independent Lambda functions
- **Factor XI**: Logs as event streams via CloudWatch

### ✅ Microservices Best Practices
- Single responsibility per service
- API-first design via EventBridge events
- Independent deployment capability
- Database per service pattern

## API Endpoints

### Scheduler Orchestrator
- `POST /scheduler/{eventId}` - Generate schedule (event-driven)
- `GET /scheduler/{eventId}` - List schedules
- `GET /scheduler/{eventId}/{scheduleId}` - Get specific schedule
- `PUT /scheduler/{eventId}/{scheduleId}` - Update schedule
- `DELETE /scheduler/{eventId}/{scheduleId}` - Delete schedule

### Response Format
```json
{
  "requestId": "req-1729368851433-abc123",
  "status": "PENDING", 
  "message": "Schedule generation in progress. Use requestId to check status.",
  "eventId": "event-123"
}
```

## Event Schemas

### Data Request Events
```json
{
  "Source": "scheduler.orchestrator",
  "DetailType": "Event Data Requested",
  "Detail": {
    "requestId": "req-1729368851433-abc123",
    "eventId": "event-123"
  }
}
```

### Data Response Events
```json
{
  "Source": "events.domain",
  "DetailType": "Event Data Response", 
  "Detail": {
    "requestId": "req-1729368851433-abc123",
    "eventId": "event-123",
    "event": { /* event data */ },
    "days": [ /* event days */ ],
    "timestamp": "2024-10-19T20:30:51.433Z"
  }
}
```

## Monitoring & Observability

### CloudWatch Metrics
- Lambda invocation counts per domain handler
- EventBridge rule execution metrics
- Error rates per domain service
- Schedule generation completion times

### Structured Logging
- All handlers use structured logging with requestId correlation
- Domain-specific log groups for troubleshooting
- Event processing traces across services

## Cost Optimization

### EventBridge Pricing
- $1.00 per million events published
- Minimal cost for schedule generation events
- No idle costs (pay-per-use model)

### Lambda Optimizations
- 256MB memory for EventBridge handlers (sufficient for data queries)
- 30-second timeout for domain handlers
- Reserved concurrency prevents runaway costs

## Future Enhancements

### 1. Real-time Status Updates
- WebSocket API for real-time schedule generation status
- Frontend polling for completion notifications

### 2. Event Sourcing
- Store all domain events for audit trail
- Replay capability for debugging and recovery

### 3. CQRS Implementation
- Separate read/write models per domain
- Optimized query handlers for complex reporting

### 4. Cross-Domain Events
- Athlete registration events → automatic category updates
- Score submission events → real-time leaderboard updates

## Deployment Status

✅ **Deployed Successfully** - October 19, 2024

- 5 EventBridge handlers deployed
- 5 EventBridge rules configured  
- Scheduler orchestrator operational
- All domain services isolated
- Direct database access removed from scheduler

## Testing

### Manual Testing
```bash
# Test schedule generation
curl -X POST https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/scheduler/event-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"competitionMode": "HEATS"}'

# Check CloudWatch logs for event flow
aws logs filter-log-events --profile labvel-dev --region us-east-2 \
  --log-group-name /aws/lambda/CalisthenicsAppStack-SchedulerLambda* \
  --filter-pattern "requestId"
```

### Verification Commands
```bash
# List EventBridge handlers
aws lambda list-functions --profile labvel-dev --region us-east-2 \
  --query 'Functions[?contains(FunctionName, `EventBridge`)].FunctionName'

# List EventBridge rules  
aws events list-rules --profile labvel-dev --region us-east-2 \
  --query 'Rules[?contains(Name, `Data`)].Name'
```

## Summary

The event-driven architecture implementation successfully:

1. **Removed direct database access** from the scheduler orchestrator
2. **Implemented proper domain separation** with dedicated EventBridge handlers
3. **Established API-based communication** via EventBridge events
4. **Maintained backward compatibility** with existing scheduler endpoints
5. **Followed microservices best practices** with single responsibility per service
6. **Achieved Twelve Factor compliance** with stateless, scalable processes

The system now properly follows Domain-Driven Design principles with clear bounded contexts and event-driven communication between domains, setting the foundation for future scalability and maintainability improvements.
