# WOD Sharing System

## Overview

The WOD sharing system allows organizations to share their workout templates across the platform while maintaining data integrity and preventing corruption when WODs are deleted.

## WOD Types

### 1. Private WODs
- **Created by**: Organization members
- **Visibility**: Only visible to the creating organization
- **Sharing**: `isShared: false`
- **Deletion**: Can be deleted if no scores exist

### 2. Shared WODs
- **Created by**: Organization members
- **Visibility**: Visible to all organizations
- **Sharing**: `isShared: true` (set by organizer)
- **Deletion**: Smart deletion with transversal conversion

### 3. Transversal WODs
- **Created by**: Super admin OR converted from shared WODs
- **Visibility**: Global templates available to all
- **Sharing**: `isTransversal: true`, `organizationId: null`
- **Deletion**: Protected - cannot be deleted

## WOD Data Structure

```javascript
{
  eventId: "template",
  wodId: "wod-1234567890",
  name: "Fran",
  description: "21-15-9 Thrusters and Pull-ups",
  format: "time",
  timeLimit: "5:00",
  movements: [...],
  createdAt: "2025-10-19T04:00:00.000Z",
  updatedAt: "2025-10-19T04:00:00.000Z",
  createdBy: "user-id",
  organizationId: "org-123", // null for transversal
  isShared: true,
  isTransversal: false
}
```

## Business Rules

### WOD Creation Rules

#### Super Admin WODs
- **Automatic Transversal**: All super admin WODs are automatically transversal
- **Global Access**: `organizationId: null`, `isShared: true`, `isTransversal: true`
- **Naming**: Standard naming without special prefixes

#### Organization WODs
- **Default Private**: New WODs are private by default (`isShared: false`)
- **Manual Sharing**: Organizers can toggle sharing via API
- **Organization Ownership**: `organizationId` set to creator's organization

### Sharing Toggle Rules

#### Who Can Toggle Sharing
- **WOD Owner**: User who created the WOD
- **Organization Admin**: Admin of the WOD's organization
- **Super Admin**: Can modify any WOD

#### Sharing Restrictions
- **Cannot Unshare**: Once a WOD is being used by other organizations, it cannot be made private
- **Usage Check**: System checks for cross-organization usage before allowing unshare

### Smart Deletion Logic

#### Deletion Authorization
1. **Super Admin**: Can delete any WOD (with smart conversion)
2. **WOD Owner**: Can delete their own WODs
3. **Organization Admin**: Can delete organization WODs

#### Deletion Decision Tree

```
WOD Deletion Request
├── Has Scores? 
│   ├── YES → ❌ DENY (Prevent data corruption)
│   └── NO → Continue
├── Is Shared AND Used by Other Orgs?
│   ├── YES → 🔄 CONVERT TO TRANSVERSAL
│   │   ├── Set isTransversal: true
│   │   ├── Set organizationId: null  
│   │   ├── Rename: "WOD Name (Transversal)"
│   │   └── ✅ PRESERVE (Maintain relationships)
│   └── NO → Continue
├── Is Transversal?
│   ├── YES → ❌ DENY (Protected global template)
│   └── NO → ✅ DELETE (Safe to remove)
```

## API Endpoints

### Create WOD
```http
POST /wods
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "name": "Fran",
  "description": "21-15-9 Thrusters and Pull-ups",
  "format": "time",
  "timeLimit": "5:00",
  "movements": [...],
  "organizationId": "org-123",
  "isShared": false
}
```

### Toggle WOD Sharing
```http
PUT /wods/{wodId}/sharing
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "isShared": true
}
```

### Delete WOD (Smart Deletion)
```http
DELETE /wods/{wodId}
Authorization: Bearer <jwt-token>
```

**Possible Responses:**
- `200`: WOD deleted successfully
- `200`: WOD converted to transversal template
- `400`: Cannot delete WOD with existing scores
- `403`: Access denied - not WOD owner
- `404`: WOD not found

### List WODs (Filtered by Access)
```http
GET /wods
Authorization: Bearer <jwt-token>
```

**Returns:**
- User's own WODs
- Shared WODs from other organizations
- Transversal templates
- All WODs (super admin only)

## Data Integrity Protection

### Preventing Data Corruption

#### Score Protection
- **Pre-deletion Check**: Scan scores table for WOD usage
- **Hard Block**: Cannot delete WODs with existing scores
- **Error Response**: Clear message with score count

#### Relationship Preservation
- **Usage Detection**: Scan for WOD usage across organizations
- **Transversal Conversion**: Convert shared WODs to global templates
- **Reference Integrity**: Maintain all existing event-WOD relationships

### Transversal Conversion Process

1. **Usage Analysis**: Check if WOD is used by other organizations
2. **Conversion Decision**: If shared and used, convert instead of delete
3. **Data Update**: 
   - Set `isTransversal: true`
   - Set `organizationId: null`
   - Update name to indicate transversal status
4. **Audit Log**: Record conversion with original owner and usage count

## Access Control Matrix

| Action | Super Admin | WOD Owner | Org Admin | Org Member | Other User |
|--------|-------------|-----------|-----------|------------|------------|
| **Create WOD** | ✅ (Transversal) | ✅ (Private) | ✅ (Private) | ✅ (Private) | ❌ |
| **View Own WODs** | ✅ All | ✅ Own | ✅ Org | ✅ Own | ❌ |
| **View Shared WODs** | ✅ All | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared |
| **Toggle Sharing** | ✅ Any | ✅ Own | ✅ Org | ❌ | ❌ |
| **Delete WOD** | ✅ Smart | ✅ Smart | ✅ Smart | ❌ | ❌ |
| **Delete Transversal** | ❌ Protected | ❌ Protected | ❌ Protected | ❌ Protected | ❌ Protected |

## Implementation Benefits

### For Organizations
- **Resource Sharing**: Access to high-quality WODs from other organizations
- **Collaboration**: Build on community-created workouts
- **Efficiency**: Reduce duplicate WOD creation efforts

### For Platform
- **Data Integrity**: Smart deletion prevents corruption
- **Relationship Preservation**: Transversal conversion maintains references
- **Scalability**: Shared resources reduce storage duplication

### For Users
- **Rich Library**: Access to diverse workout templates
- **Quality Content**: Benefit from community-vetted WODs
- **Flexibility**: Choose between private and shared creation

## Monitoring and Analytics

### Usage Metrics
- **Sharing Rate**: Percentage of WODs marked as shared
- **Cross-Organization Usage**: How often shared WODs are used
- **Conversion Rate**: Frequency of transversal conversions

### Data Quality Metrics
- **Deletion Success Rate**: Percentage of successful deletions
- **Conversion Accuracy**: Correctness of transversal conversions
- **Reference Integrity**: Zero orphaned WOD references

### Performance Metrics
- **Query Performance**: Speed of filtered WOD listings
- **Deletion Latency**: Time for smart deletion processing
- **Usage Analysis Speed**: Performance of cross-organization checks
