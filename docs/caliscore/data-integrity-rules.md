# Data Integrity Business Rules

## Cascade Deletion Rules

### Event Deletion
**Current Implementation**: ✅ **Properly Protected**
- Prevents deletion of published events
- Cleans up athlete registrations before deletion
- Validates organization membership

**Business Rules**:
1. **Published Event Protection**: Cannot delete events with `published: true`
2. **Registration Cleanup**: Remove all athlete registrations first
3. **Organization Validation**: Only organization members can delete
4. **Super Admin Override**: Can delete any event including legacy events

### WOD Deletion
**Current Implementation**: ❌ **No Protection**
- No validation for active usage
- No cascade cleanup of related data
- Only deletes template WODs

**Required Business Rules**:
1. **Active Usage Check**: Prevent deletion if WOD has scores
2. **Event Association Check**: Prevent deletion if WOD is in published events
3. **Cascade Cleanup**: Remove scores, event associations, schedules
4. **Organization Validation**: Check event ownership through organization

### Category Deletion
**Current Implementation**: ❌ **Unknown Status**
- Need to verify cascade deletion logic
- Check athlete registration dependencies
- Validate event associations

**Required Business Rules**:
1. **Athlete Registration Check**: Prevent deletion if athletes are registered in category
2. **Event Association Check**: Prevent deletion if category is assigned to events
3. **Score Dependencies**: Check if scores exist for category
4. **Cascade Cleanup**: Remove all related data safely

## Referential Integrity

### Primary Relationships
```
Organizations (1) ←→ (N) OrganizationMembers
Organizations (1) ←→ (N) OrganizationEvents  
Events (1) ←→ (N) AthleteEvents
Events (1) ←→ (N) Categories
Events (1) ←→ (N) WODs
Events (1) ←→ (N) Scores
Athletes (1) ←→ (N) AthleteEvents
Athletes (1) ←→ (N) Scores
WODs (1) ←→ (N) Scores
Categories (1) ←→ (N) Scores
```

### Orphaned Data Risks

#### High Risk (Current Issues)
- **WOD Deletion**: Orphans scores with invalid `wodId`
- **Category Changes**: May orphan athlete registrations
- **Organization Changes**: May break event access

#### Medium Risk (Potential Issues)
- **Event Status Changes**: May affect athlete registrations
- **User Deletion**: May orphan scores and registrations
- **Organization Deletion**: May orphan events and members

#### Low Risk (Protected)
- **Event Deletion**: Properly validates and cleans up
- **Published Events**: Cannot be deleted

## Data Consistency Rules

### Event State Management
1. **Draft → Published**: Validate all required data exists
2. **Published → Completed**: Ensure all scores are finalized
3. **Status Changes**: Validate state transitions are allowed

### Score Submission Rules
1. **Event Must Be Published**: Cannot submit scores to draft events
2. **Athlete Must Be Registered**: Verify registration in AthleteEvents table
3. **Category Validation**: Ensure athlete is registered in correct category
4. **WOD Validation**: Ensure WOD exists and belongs to event

### Registration Rules
1. **Event Must Be Published**: Cannot register for draft events
2. **Category Must Exist**: Validate category exists for event
3. **Duplicate Prevention**: One registration per athlete per event
4. **Capacity Limits**: Respect maxParticipants if set

## Field Consistency Issues

### Identified Inconsistencies
1. **AthleteEvents Table**: Uses both `registrationDate` and `registeredAt`
2. **GSI Expectations**: GSI expects `registeredAt` but data has `registrationDate`
3. **Query Failures**: GSI queries fail silently, requiring table scans

### Required Standardization
1. **Date Fields**: Standardize on `registeredAt` across all tables
2. **ID Fields**: Consistent naming (userId vs athleteId)
3. **Status Fields**: Standardize status values and types
4. **Timestamp Fields**: Use ISO 8601 format consistently

## Validation Rules

### Pre-Operation Validation
1. **Existence Checks**: Verify all referenced entities exist
2. **Permission Checks**: Validate user has required permissions
3. **State Checks**: Ensure operation is valid for current state
4. **Constraint Checks**: Validate business rule constraints

### Post-Operation Validation
1. **Referential Integrity**: Verify all references remain valid
2. **Data Consistency**: Check related data is updated correctly
3. **Index Consistency**: Ensure GSI data matches table data
4. **Audit Trail**: Log all changes for tracking

## Recovery Procedures

### Orphaned Data Cleanup
1. **Identify Orphans**: Scan for invalid references
2. **Impact Assessment**: Determine scope of affected data
3. **Safe Removal**: Remove orphaned records safely
4. **Verification**: Confirm cleanup completed successfully

### Data Repair Scripts
1. **Field Standardization**: Convert inconsistent field names
2. **Missing Data**: Populate required fields with defaults
3. **Invalid References**: Fix or remove broken relationships
4. **Index Rebuild**: Recreate GSI with correct field mappings

## Monitoring Requirements

### Real-Time Monitoring
1. **Failed Queries**: Alert on GSI query failures
2. **Orphaned Records**: Detect referential integrity violations
3. **Invalid States**: Monitor for impossible data combinations
4. **Performance Issues**: Track slow queries and table scans

### Periodic Audits
1. **Data Consistency**: Weekly validation of all relationships
2. **Orphaned Data**: Monthly cleanup of invalid references
3. **Field Consistency**: Quarterly standardization checks
4. **Performance Review**: Monthly query optimization analysis
