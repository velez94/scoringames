# WOD Seed Data - Final State

## Overview
After cleanup, the platform has 5 WODs as seed data with no duplicates.

## WOD Inventory

### 1. **persuit** (2 versions)

#### Shared Template
- **Event ID**: `e1dfbf7b-fcdb-414d-b505-10bc8df125a8`
- **WOD ID**: `wod-1760830267755`
- **Format**: Ladder
- **Shared**: Yes
- **Purpose**: Reusable template for all organizations

#### Event-Specific
- **Event ID**: `evt-1760712524698`
- **WOD ID**: `wod-1760830267755`
- **Format**: Ladder
- **Shared**: No
- **Purpose**: Specific to one event

**Movements:**
- 12 One Arm Pull Up
- 20 Bar Dips (Bodyweight)

**Max Score**: 590 pts (EDS: 116 × 5 + 10 bonus)

---

### 2. **Grace** (2 versions)

#### Template (Global)
- **Event ID**: `template`
- **WOD ID**: `wod-2`
- **Format**: Not specified
- **Shared**: No (Template)
- **Purpose**: Global template available to all

#### Shared Version
- **Event ID**: `e1dfbf7b-fcdb-414d-b505-10bc8df125a8`
- **WOD ID**: `wod-2`
- **Format**: Not specified
- **Shared**: Yes
- **Purpose**: Shared across organizations

**Movements:**
- 15 Muscle Up (Weighted)
- 40 Squats (Weighted)

**Description**: 30 Clean and Jerks for time

**Max Score**: 485 pts (EDS: 95 × 5 + 10 bonus)

---

### 3. **Murph** (1 version)

#### Event-Specific
- **Event ID**: `e1dfbf7b-fcdb-414d-b505-10bc8df125a8`
- **WOD ID**: `wod-3`
- **Format**: Not specified
- **Shared**: No
- **Purpose**: Event-specific WOD

**Description**: 1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run

**Note**: No movements defined (description only)

---

## Cleanup Summary

### Deleted Duplicates
- **Grace**: Removed 2 duplicates (kept 1 template + 1 shared)
- **Murph**: Removed 1 duplicate (kept 1 event-specific)
- **Total Deleted**: 3 WODs

### Final Count
- **Total WODs**: 5
- **Templates**: 1 (Grace)
- **Shared**: 2 (persuit, Grace)
- **Event-Specific**: 2 (persuit, Murph)

## Usage Guidelines

### For Organizers
- **Templates**: Use `eventId: 'template'` WODs as starting points
- **Shared WODs**: Can be used across multiple events
- **Event-Specific**: Customized for specific competitions

### For Development
- These WODs serve as seed data for testing
- Each WOD type demonstrates different use cases
- Maintain this structure for consistent testing

## Maintenance

To prevent future duplicates:
1. Check for existing WOD names before creating new ones
2. Use templates when possible
3. Mark WODs as shared only when intended for reuse
4. Run cleanup script periodically: `scripts/cleanup-duplicate-wods-v2.js`
