# WOD Types Guide - ScorinGames Platform

## Overview

ScorinGames supports three types of WODs (Workouts of the Day) with different levels of availability and sharing. Each type is visually indicated with colored badges in the interface.

## WOD Types

### 🔵 Template WODs
**System-provided baseline workouts available to all organizers**

- **Created by**: System/Super Admin only
- **Storage**: `eventId: 'template'`
- **Sharing**: `isShared: false` (but globally available)
- **Badge**: Blue "Template" badge
- **Purpose**: Standard baseline workouts for all competition organizers
- **Examples**: 
  - Baseline AMRAP - Men Elite
  - Baseline AMRAP - Women Advanced
  - The Gauntlet (Chipper)

**Characteristics:**
- Pre-seeded by the system (10 baseline WODs)
- Category-specific difficulty levels
- Cannot be modified by organizers
- Always available in event creation

### 🟣 Shared WODs
**Organizer-created workouts shared with the community**

- **Created by**: Any event organizer
- **Storage**: `eventId: 'evt-123'` (specific event)
- **Sharing**: `isShared: true` (set by organizer)
- **Badge**: Purple "Shared" badge
- **Purpose**: Community-contributed workouts for reuse
- **Ownership**: Remains with original organization

**How to Create:**
1. Create WOD for your event
2. Mark as "Shared" in WOD settings
3. WOD becomes available to all other organizers
4. Original organization retains ownership

### 🟢 Transversal WODs
**Elevated shared WODs with global status**

- **Created by**: System conversion or Super Admin
- **Storage**: Any `eventId` or `'transversal'`
- **Sharing**: `isTransversal: true`
- **Badge**: Green "Transversal" badge
- **Purpose**: High-quality WODs promoted to global status
- **Conversion**: Shared WODs can be converted to transversal by admins

**Conversion Criteria:**
- Popular shared WODs with high usage
- Quality workouts suitable for global use
- Admin approval for transversal status

### Private WODs (No Badge)
**Organization-specific workouts**

- **Created by**: Event organizers
- **Storage**: `eventId: 'evt-123'` (specific event)
- **Sharing**: `isShared: false`
- **Badge**: No badge (default)
- **Purpose**: Internal organization workouts
- **Visibility**: Only visible to creating organization

## WOD Availability Matrix

| WOD Type | Creator | Visibility | Can Modify | Can Delete | Badge Color |
|----------|---------|------------|------------|------------|-------------|
| **Template** | System | All Organizers | ❌ | ❌ | 🔵 Blue |
| **Shared** | Organizer | All Organizers | ✅ Owner Only | ✅ Owner Only | 🟣 Purple |
| **Transversal** | System/Admin | All Organizers | ❌ | ❌ | 🟢 Green |
| **Private** | Organizer | Own Organization | ✅ Owner Only | ✅ Owner Only | None |

## User Workflows

### For Event Organizers

#### Creating a New WOD
1. Navigate to WOD Management or Event Edit
2. Click "Create WOD"
3. Fill in WOD details (name, format, movements)
4. Choose sharing level:
   - **Private**: Keep within organization
   - **Shared**: Make available to all organizers

#### Using Existing WODs
1. Go to Event Edit → Available WODs
2. Browse WODs by type (badges indicate source):
   - 🔵 **Template**: System baseline WODs
   - 🟣 **Shared**: Community-contributed WODs
   - 🟢 **Transversal**: Premium global WODs
3. Click "Add" to include in your event

#### Sharing Your WODs
1. Create WOD for your event
2. In WOD settings, toggle "Share with community"
3. WOD becomes available to all organizers
4. Appears with purple "Shared" badge

### For Athletes
- See all WODs assigned to events they're registered for
- Cannot distinguish between WOD types (internal classification)
- Experience consistent workout quality regardless of source

## Best Practices

### For Organizers
- **Use Templates**: Start with system templates for standard competitions
- **Share Quality WODs**: Contribute well-designed workouts to the community
- **Test Before Sharing**: Ensure WODs are properly formatted and tested
- **Clear Naming**: Use descriptive names for shared WODs

### For Platform Admins
- **Curate Templates**: Maintain high-quality baseline WOD library
- **Promote to Transversal**: Elevate exceptional shared WODs
- **Monitor Quality**: Review shared WODs for appropriateness
- **Update Templates**: Refresh baseline WODs based on community feedback

## Technical Implementation

### Database Schema
```javascript
// Template WOD
{
  eventId: 'template',
  wodId: 'baseline-men-elite',
  isShared: false,
  isTransversal: false,
  // ... other fields
}

// Shared WOD
{
  eventId: 'evt-123',
  wodId: 'custom-wod-456',
  isShared: true,
  isTransversal: false,
  organizationId: 'org-789',
  // ... other fields
}

// Transversal WOD
{
  eventId: 'evt-456',
  wodId: 'elite-challenge-789',
  isShared: true,
  isTransversal: true,
  organizationId: null,
  // ... other fields
}
```

### API Filtering
```javascript
// Available WODs query includes:
wod.eventId === 'template' ||     // Templates
wod.isShared === true ||          // Shared WODs
wod.isTransversal === true        // Transversal WODs
```

## Benefits

### Community Building
- Organizers share creative workouts
- Cross-pollination of ideas
- Quality improvement through community feedback

### Standardization
- Consistent baseline WODs across platform
- Reliable difficulty progression
- Professional competition standards

### Flexibility
- Organizations can keep proprietary WODs private
- Option to contribute to community
- System-curated quality templates

## Future Enhancements

- **Rating System**: Community ratings for shared WODs
- **Usage Analytics**: Track popular WODs and templates
- **Automatic Promotion**: AI-driven transversal promotion based on usage
- **WOD Categories**: Filtering by difficulty, equipment, time
- **Version Control**: Track WOD modifications and improvements
