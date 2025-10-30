# WOD Organization Tracking

## Overview
When an event reuses a template WOD, a new WOD entry is created and automatically linked to the organization that owns the event.

## Implementation

### Backend Changes

#### WODs Lambda (`lambda/wods.js`)
- Added `ORGANIZATION_EVENTS_TABLE` environment variable
- On WOD creation, looks up the event's organization via `OrganizationEventsTable`
- Stores `organizationId` field in the WOD record

#### CDK Stack (`lib/calisthenics-app-stack.ts`)
- Added `ORGANIZATION_EVENTS_TABLE` to WODs Lambda environment
- Granted read access to `organizationEventsTable` for WODs Lambda

### WOD Types and Organization Tracking

#### 1. Template WODs
- **eventId**: `template`
- **organizationId**: `null`
- **Purpose**: Global templates available to all
- **Example**: Grace template

#### 2. Transversal WODs
- **eventId**: `transversal` or any event
- **isTransversal**: `true`
- **organizationId**: `null`
- **Purpose**: Shared across all organizations
- **Example**: Converted shared WODs

#### 3. Shared WODs
- **eventId**: Specific event ID
- **isShared**: `true`
- **organizationId**: `null` (legacy) or organization ID
- **Purpose**: Reusable across events
- **Example**: persuit (shared)

#### 4. Event-Specific WODs
- **eventId**: Specific event ID
- **isShared**: `false`
- **organizationId**: Organization ID ✅
- **Purpose**: Custom WOD for one event
- **Example**: persuit (evt-1760712524698)

## Current State

After migration:

```
┌─────────────────────────────────────────────────────────────────┐
│ WOD Name │ Event ID              │ Organization ID    │ Type    │
├──────────┼───────────────────────┼────────────────────┼─────────┤
│ persuit  │ e1dfbf7b-fcdb...      │ null               │ Shared  │
│ Grace    │ e1dfbf7b-fcdb...      │ null               │ Shared  │
│ Murph    │ e1dfbf7b-fcdb...      │ null               │ Event   │
│ Grace    │ template              │ null               │ Template│
│ persuit  │ evt-1760712524698     │ org-1760712321123  │ Event ✅│
└─────────────────────────────────────────────────────────────────┘
```

## Benefits

### For Organizations
- ✅ Track which WODs belong to their events
- ✅ Filter WODs by organization
- ✅ Manage organization-specific WOD library

### For Platform
- ✅ Better data organization
- ✅ Enable organization-scoped WOD queries
- ✅ Support multi-tenant WOD management

### For Future Features
- Organization WOD library view
- WOD usage analytics per organization
- Organization-specific WOD templates
- WOD sharing between organizations

## Migration

The migration script (`scripts/add-organization-to-wods.js`) was run to:
- ✅ Add `organizationId` to existing event-specific WODs
- ✅ Skip templates and transversal WODs (keep `null`)
- ✅ Updated 1 WOD with organization tracking

## Usage

### Creating a New WOD
When creating a WOD for an event:
```javascript
POST /wods
{
  "eventId": "evt-123",
  "name": "My WOD",
  "movements": [...]
}

// Backend automatically adds:
// organizationId: "org-456" (from event's organization)
```

### Querying WODs by Organization
Future enhancement - filter WODs:
```javascript
GET /wods?organizationId=org-456
// Returns all WODs for this organization
```

## Notes

- Template WODs (`eventId: 'template'`) always have `organizationId: null`
- Transversal WODs always have `organizationId: null`
- Shared WODs may have `organizationId: null` (legacy) or specific org ID
- Event-specific WODs always have `organizationId` set
