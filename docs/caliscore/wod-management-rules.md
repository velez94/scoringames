# WOD Management Business Rules

## Authorization (RBAC)

### Who Can Delete WODs

**Current Implementation**: ❌ **NO AUTHORIZATION CHECKS**
- Any authenticated user can delete template WODs
- No organization membership validation
- No role-based restrictions

**Required Implementation**: ✅ **RBAC Authorization**
- **Super Admin** (`admin@athleon.fitness`): Can delete any WOD
- **Organization Owner**: Can delete WODs in their organization's events
- **Organization Admin**: Can delete WODs in their organization's events  
- **Organization Member**: Can delete WODs in their organization's events
- **Athletes**: Cannot delete WODs

### Current Deletion Scope

**Template WODs Only**: 
- DELETE `/wods/{wodId}` only deletes `eventId: 'template'` WODs
- Cannot delete event-specific WODs directly
- Event-specific WODs can only be removed via event association updates

## Data Integrity Issues

### Orphaned References
When a WOD is deleted, the following data becomes orphaned:

1. **Scores Table**: 
   - Contains `wodId` references to deleted WODs
   - No cascade deletion implemented
   - Breaks leaderboard calculations

2. **Event Associations**:
   - Events may still reference deleted WOD IDs
   - Frontend may show broken WOD selections

3. **Scheduler Data**:
   - Schedules may reference deleted WODs
   - Competition flow disrupted

### Missing Validations

**No Protection Against**:
- Deleting WODs with existing scores
- Deleting WODs assigned to published events
- Deleting WODs used in active competitions

## Required Business Rules

### Pre-Deletion Validation
1. **Check Active Usage**:
   - Prevent deletion if WOD has scores
   - Prevent deletion if WOD is in published events
   - Prevent deletion if WOD is in active schedules

2. **Organization Ownership**:
   - Validate user belongs to organization that owns the event
   - Super admin can bypass organization checks

### Cascade Deletion Logic
1. **Clean Related Data**:
   - Remove all scores for the WOD
   - Remove WOD from event associations
   - Remove WOD from schedules
   - Update leaderboards

2. **Audit Trail**:
   - Log who deleted the WOD
   - Log what data was cleaned up
   - Maintain deletion history

### Safe Deletion Process
1. **Validation Phase**:
   - Check authorization
   - Check active usage
   - Confirm cascade impact

2. **Cleanup Phase**:
   - Remove scores
   - Remove associations
   - Remove schedules

3. **Deletion Phase**:
   - Delete WOD record
   - Log deletion event

## Implementation Priority

### Critical (Security)
- [ ] Add RBAC authorization to WODs Lambda
- [ ] Implement organization membership validation
- [ ] Add role-based access control

### High (Data Integrity)
- [ ] Add pre-deletion validation
- [ ] Implement cascade deletion logic
- [ ] Add orphaned data cleanup

### Medium (User Experience)
- [ ] Add deletion confirmation dialogs
- [ ] Show impact warnings before deletion
- [ ] Implement soft delete with recovery option

### Low (Audit)
- [ ] Add deletion audit trail
- [ ] Implement deletion history tracking
- [ ] Add admin deletion reports
