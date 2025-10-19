# DDD-Compliant Cascade Deletion Architecture

## Problem with Previous Implementation

### ❌ **Violations of DDD Principles:**

1. **Cross-Bounded Context Data Access**
   ```javascript
   // WODs service directly accessing Scores table - VIOLATION
   const scores = await ddb.scan({ TableName: SCORES_TABLE });
   ```

2. **Tight Coupling Between Services**
   - WODs service knows about Scores table structure
   - Direct database access across service boundaries
   - Synchronous cross-service validation

3. **Mixed Aggregate Responsibilities**
   - Single service managing multiple aggregates
   - No clear bounded context separation

## ✅ **DDD-Compliant Solution: Event-Driven Cascade**

### **Bounded Contexts**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WODs Context  │    │  Scores Context │    │  Events Context │
│                 │    │                 │    │                 │
│ - WOD Aggregate │    │ - Score Aggregate│    │ - Event Aggregate│
│ - WOD Repository│    │ - Score Repository│   │ - Event Repository│
│ - WOD Service   │    │ - Score Service │    │ - Event Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Event Bus     │
                    │  (EventBridge)  │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Orchestrator  │
                    │  (Saga Pattern) │
                    └─────────────────┘
```

### **Event Flow Architecture**

```
1. WOD Deletion Request
   ┌─────────────┐
   │ WODs Service│ ──► WOD_DELETION_REQUESTED
   └─────────────┘

2. Validation Coordination  
   ┌─────────────┐
   │Orchestrator │ ──► VALIDATE_WOD_SCORES ──► Scores Service
   │             │ ──► VALIDATE_WOD_EVENTS ──► Events Service
   └─────────────┘

3. Validation Results
   ┌─────────────┐
   │Scores Service│ ──► SCORES_VALIDATION_COMPLETED
   └─────────────┘
   ┌─────────────┐  
   │Events Service│ ──► EVENTS_VALIDATION_COMPLETED
   └─────────────┘

4. Final Decision
   ┌─────────────┐
   │Orchestrator │ ──► WOD_DELETION_COMPLETED
   └─────────────┘
```

## **Domain Events**

### **1. WOD_DELETION_REQUESTED**
```javascript
{
  eventType: 'WOD_DELETION_REQUESTED',
  wodId: 'wod-123',
  requestedBy: 'user-456',
  timestamp: '2025-10-19T00:00:00.000Z',
  wodData: { /* WOD aggregate data */ }
}
```

### **2. VALIDATE_WOD_SCORES**
```javascript
{
  eventType: 'VALIDATE_WOD_SCORES',
  wodId: 'wod-123',
  requestId: '2025-10-19T00:00:00.000Z',
  requestedBy: 'user-456'
}
```

### **3. SCORES_VALIDATION_COMPLETED**
```javascript
{
  eventType: 'SCORES_VALIDATION_COMPLETED',
  wodId: 'wod-123',
  requestId: '2025-10-19T00:00:00.000Z',
  hasScores: true,
  scoresCount: 15
}
```

### **4. WOD_DELETION_COMPLETED**
```javascript
{
  eventType: 'WOD_DELETION_COMPLETED',
  wodId: 'wod-123',
  requestId: '2025-10-19T00:00:00.000Z',
  success: true,
  action: 'converted_to_transversal',
  reason: 'Preserved relationships with other organizations'
}
```

## **Service Responsibilities**

### **WODs Service (WODs Bounded Context)**
- **Owns**: WOD aggregate, WOD business rules
- **Responsibilities**: 
  - WOD creation, updates, sharing
  - Authorization within WODs context
  - Transversal conversion logic
- **Does NOT**: Access other services' data directly

### **Scores Service (Scores Bounded Context)**  
- **Owns**: Score aggregate, scoring business rules
- **Responsibilities**:
  - Score validation for WOD deletion
  - Score cleanup (if needed)
- **Does NOT**: Make WOD deletion decisions

### **Events Service (Events Bounded Context)**
- **Owns**: Event aggregate, event business rules  
- **Responsibilities**:
  - Event-WOD relationship validation
  - Usage analysis for WOD deletion
- **Does NOT**: Access WODs or Scores data directly

### **Cascade Orchestrator (Application Service)**
- **Owns**: Cross-context coordination logic
- **Responsibilities**:
  - Saga pattern implementation
  - Event routing and correlation
  - Final decision making based on all validations
- **Does NOT**: Own any domain aggregates

## **Benefits of DDD Approach**

### **1. Bounded Context Isolation**
- Each service owns its data and business rules
- No cross-service database access
- Clear aggregate boundaries

### **2. Loose Coupling**
- Services communicate via events only
- No direct service-to-service calls
- Independent deployment and scaling

### **3. Eventual Consistency**
- Asynchronous processing
- Better fault tolerance
- Scalable architecture

### **4. Domain-Driven Design**
- Business logic stays within appropriate contexts
- Clear separation of concerns
- Maintainable and extensible

## **Implementation Pattern: Saga**

### **Orchestration Saga**
```javascript
class WodDeletionSaga {
  async handle(wodDeletionRequested) {
    // Step 1: Request validations
    await this.requestScoresValidation(wodDeletionRequested);
    await this.requestEventsValidation(wodDeletionRequested);
    
    // Step 2: Wait for all validations
    const validations = await this.waitForValidations(wodDeletionRequested.requestId);
    
    // Step 3: Make final decision
    const decision = this.makeDecision(validations, wodDeletionRequested.wodData);
    
    // Step 4: Execute decision
    await this.executeDeletion(decision);
    
    // Step 5: Publish result
    await this.publishResult(decision);
  }
}
```

## **Error Handling**

### **Compensation Actions**
- **Validation Timeout**: Fail deletion request
- **Partial Failure**: Rollback any changes
- **Service Unavailable**: Retry with exponential backoff

### **Idempotency**
- All events include correlation IDs
- Duplicate event detection
- Safe retry mechanisms

## **Monitoring and Observability**

### **Saga State Tracking**
- Track saga execution progress
- Monitor validation timeouts
- Alert on failed compensations

### **Event Tracing**
- Correlation IDs across all events
- End-to-end request tracing
- Performance monitoring

## **Migration Strategy**

### **Phase 1: Event Infrastructure**
1. Deploy EventBridge setup
2. Create orchestrator service
3. Add event publishing to existing services

### **Phase 2: Validation Services**
1. Add event handlers to Scores service
2. Add event handlers to Events service  
3. Test validation flows

### **Phase 3: Cutover**
1. Switch WODs service to event-driven deletion
2. Remove direct cross-service calls
3. Monitor and validate behavior

This DDD-compliant approach ensures proper separation of concerns, maintains bounded context integrity, and provides a scalable foundation for complex business operations.
