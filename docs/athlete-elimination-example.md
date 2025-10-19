# Athlete Elimination System - Usage Example

## Overview
The athlete elimination system automatically eliminates athletes between filters based on their scores, allowing for progressive competition formats.

## Example Scenario - VERSUS Mode
- **12 athletes** registered for competition
- **3 filters** (qualifying rounds)
- **VERSUS mode** with specified number of heats per round
- **Elimination rules**: 
  - Filter 1: 6 heats (12 athletes → 6 winners)
  - Filter 2: 3 heats (6 athletes → 3 winners) 
  - Filter 3: Final heat (3 athletes → 1 winner)

## API Usage

### 1. Create Schedule with VERSUS Mode and Elimination Rules
```javascript
POST /competitions/{eventId}/schedule
{
  "wods": [...],
  "categories": [...],
  "athletes": [12 athletes],
  "competitionMode": "VERSUS",
  "numberOfHeats": 6, // REQUIRED for VERSUS mode
  "filters": [
    {
      "filterId": "filter-1",
      "name": "Qualifying Round 1",
      "eliminationCount": 6, // Eliminate 6 losers, keep 6 winners
      "eliminationType": "BOTTOM_SCORES"
    },
    {
      "filterId": "filter-2", 
      "name": "Semi-Final",
      "eliminationCount": 3, // Eliminate 3 losers, keep 3 winners
      "eliminationType": "BOTTOM_SCORES"
    },
    {
      "filterId": "filter-3",
      "name": "Final",
      "eliminationCount": 0 // No elimination in final
    }
  ]
}
```

### VERSUS Mode Structure
- **Heat 1**: Athlete A vs Athlete B
- **Heat 2**: Athlete C vs Athlete D  
- **Heat 3**: Athlete E vs Athlete F
- **Heat 4**: Athlete G vs Athlete H
- **Heat 5**: Athlete I vs Athlete J
- **Heat 6**: Athlete K vs Athlete L

After Filter 1 elimination: 6 winners advance to next round with 3 heats.

### 2. Eliminate Athletes After Each Filter
```javascript
POST /competitions/{eventId}/schedule/{scheduleId}/eliminate
{
  "filterId": "filter-1",
  "eliminationCount": 4,
  "eliminationType": "BOTTOM_SCORES"
}
```

**Response:**
```javascript
{
  "eliminated": [
    { "athleteId": "athlete-9", "score": 45 },
    { "athleteId": "athlete-12", "score": 42 },
    { "athleteId": "athlete-3", "score": 38 },
    { "athleteId": "athlete-7", "score": 35 }
  ],
  "remaining": [
    { "athleteId": "athlete-1", "score": 95 },
    { "athleteId": "athlete-5", "score": 88 },
    // ... 6 more athletes
  ],
  "eliminationCount": 4
}
```

### 3. Process All Filter Progressions Automatically
```javascript
POST /competitions/{eventId}/schedule/{scheduleId}/progression
```

**Response:**
```javascript
{
  "results": [
    {
      "filterId": "filter-1",
      "filterName": "Qualifying Round 1", 
      "eliminated": 4,
      "remaining": 8
    },
    {
      "filterId": "filter-2",
      "filterName": "Qualifying Round 2",
      "eliminated": 3, 
      "remaining": 5
    }
  ],
  "activeAthletes": 5
}
```

## Elimination Types

### BOTTOM_SCORES (Default)
Eliminates athletes with the lowest scores first.

### TOP_SCORES  
Eliminates athletes with the highest scores first (useful for time-based competitions where lower is better).

### RANDOM
Random elimination (useful for tie-breaking scenarios).

## Integration with Competition Modes

### HEATS Mode
- Initial heats created with all registered athletes
- After each filter, new heats generated with remaining athletes
- Heat sizes automatically adjusted based on remaining athlete count

### VERSUS Mode
- 1v1 matches created with remaining athletes after each elimination
- Bracket automatically restructured based on eliminations
- Sequential timing maintained

### SIMULTANEOUS Mode
- All remaining athletes compete together
- No heat restructuring needed
- Simple elimination based on scores

## Database Updates

The system automatically updates:
- **ClassificationFiltersTable**: Tracks eliminated/remaining athletes per filter
- **SchedulesTable**: Updates active athlete list and progression results
- **ScoresTable**: Links scores to specific filters for elimination logic

## Frontend Integration

The React scheduler component can display:
- Current active athletes per filter
- Elimination history and results
- Progression timeline
- Remaining athlete count for next rounds

## Example Competition Flow

1. **Setup**: 12 athletes, 3 filters with elimination rules
2. **Filter 1**: All 12 athletes compete → 4 eliminated → 8 remain
3. **Filter 2**: 8 athletes compete → 3 eliminated → 5 remain  
4. **Filter 3**: Final 5 athletes compete → Winner determined

This creates a progressive elimination tournament that automatically manages athlete progression based on performance scores.
