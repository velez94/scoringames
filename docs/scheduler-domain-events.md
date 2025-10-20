# Schedule Domain Events

## Overview
The DDD-compliant scheduler publishes domain events to enable loose coupling and event-driven architecture.

## Domain Events

### ScheduleGenerated
Published when a new schedule is created.

```json
{
  "eventType": "ScheduleGenerated",
  "eventId": "event-123",
  "scheduleId": "schedule-456",
  "totalDuration": 8.5,
  "daysCount": 2,
  "sessionsCount": 12,
  "timestamp": "2025-10-19T22:15:00.000Z"
}
```

### SchedulePublished
Published when a schedule is made public.

```json
{
  "eventType": "SchedulePublished",
  "eventId": "event-123",
  "scheduleId": "schedule-456",
  "publishedAt": "2025-10-19T22:15:00.000Z",
  "timestamp": "2025-10-19T22:15:00.000Z"
}
```

### ScheduleUpdated
Published when schedule details are modified.

```json
{
  "eventType": "ScheduleUpdated",
  "eventId": "event-123",
  "scheduleId": "schedule-456",
  "updatedSessions": ["session-1", "session-2"],
  "timestamp": "2025-10-19T22:15:00.000Z"
}
```

### ScheduleDeleted
Published when a schedule is removed.

```json
{
  "eventType": "ScheduleDeleted",
  "eventId": "event-123",
  "scheduleId": "schedule-456",
  "timestamp": "2025-10-19T22:15:00.000Z"
}
```

## Event Consumers

### Notification Service
- Sends notifications to athletes when schedules are published
- Alerts organizers of schedule changes

### Analytics Service
- Tracks schedule generation patterns
- Monitors competition format preferences

### Mobile App Service
- Syncs schedule data to mobile applications
- Triggers push notifications

## Event Bus Configuration

Events are published to the `schedule-events` EventBridge bus with:
- **Source**: `schedule.service`
- **DetailType**: Event type (e.g., "ScheduleGenerated")
- **Detail**: Event payload

## Integration Patterns

### Saga Pattern
For complex workflows involving multiple bounded contexts:

```javascript
// Example: Event registration workflow
1. SchedulePublished → Trigger athlete notifications
2. AthleteRegistered → Update schedule capacity
3. ScheduleUpdated → Notify registered athletes
```

### CQRS Pattern
Separate read/write models:
- **Command**: Schedule generation/updates
- **Query**: Public schedule viewing
- **Projection**: Optimized read models for mobile apps

## Monitoring

Track domain events in CloudWatch:
- Event publication success/failure rates
- Event processing latency
- Consumer error rates

## Future Events

Planned domain events for enhanced functionality:

- `ScheduleConflictDetected`
- `AthleteScheduleGenerated`
- `JudgeAssignmentCreated`
- `EquipmentAllocationUpdated`
