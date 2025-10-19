# Competition Scheduler System

## Overview

The Competition Scheduler is an intelligent system that automatically generates competition schedules based on WODs, athletes, categories, and classification filters. It optimizes for time constraints while supporting dynamic modifications by organizers.

## Key Features

### 1. **Automatic Schedule Generation**
- Distributes athletes across categories and heats
- Calculates optimal time slots within day constraints (max 10 hours + 1 hour lunch)
- Supports both sequential and simultaneous competition modes
- Handles multiple WODs and competition days

### 2. **Classification System**
- Configurable elimination filters per category
- Multiple filter types: ranking, score threshold, time-based
- Progressive elimination rounds (e.g., 12 → 8 → 4 athletes)
- Dynamic filter application based on organizer rules

### 3. **Competition Modes**

#### Sequential Mode
- Athletes compete in heats (default 8 per heat)
- One heat at a time per category
- Longer duration but simpler logistics

#### Simultaneous Mode  
- All athletes compete at once using stations
- Shorter duration but requires more equipment
- Better for large numbers of athletes

### 4. **Dynamic Editing**
- Organizers can modify start times
- Adjust heat compositions
- Add/remove classification filters
- Real-time schedule updates

## Data Model

### Schedules Table
```
PK: eventId
SK: scheduleId
Attributes: days[], totalDuration, generatedAt, config
```

### Heats Table
```
PK: scheduleId  
SK: heatId
Attributes: sessionId, athletes[], stations[], startTime
```

### Classification Filters Table
```
PK: eventId
SK: filterId
Attributes: categoryId, name, type, eliminateCount, criteria, order
```

## API Endpoints

### Generate Schedule
```
POST /competitions/{eventId}/schedule
Body: {
  wods: [...],
  categories: [...], 
  athletes: [...],
  days: [...],
  maxDayHours: 10,
  lunchBreakHours: 1,
  stationsMode: "SEQUENTIAL|SIMULTANEOUS",
  athletesPerHeat: 8
}
```

### Get Schedule with Classification
```
GET /competitions/{eventId}/schedule?scheduleId={id}
Returns: Schedule with applied classification results
```

### Update Schedule
```
PUT /competitions/{eventId}/schedule/{scheduleId}
Body: {
  timeAdjustments: [{ sessionId, newStartTime }],
  sessions: [{ sessionId, updates }]
}
```

### Manage Classification Filters
```
POST /competitions/{eventId}/classification-filters
Body: {
  categoryId: "male-elite",
  name: "Semi-Final Elimination", 
  type: "RANKING",
  eliminateCount: 4,
  criteria: {}
}
```

## Classification Filter Types

### 1. Ranking Based (`RANKING`)
- Eliminates bottom N athletes by total score
- Criteria: None (uses overall ranking)
- Example: Eliminate bottom 4 athletes

### 2. Score Threshold (`SCORE_THRESHOLD`)  
- Eliminates athletes below minimum score
- Criteria: `{ minScore: 800 }`
- Example: Eliminate athletes with score < 800

### 3. Time Based (`TIME_BASED`)
- Eliminates athletes above maximum time
- Criteria: `{ maxTime: 300 }` (seconds)
- Example: Eliminate athletes slower than 5 minutes

## Example Usage

### Sample Event Configuration
```javascript
const config = {
  wods: [
    { wodId: 'wod-1', dayId: 'day-1', estimatedDuration: 20 },
    { wodId: 'wod-2', dayId: 'day-1', estimatedDuration: 30 },
    { wodId: 'wod-3', dayId: 'day-1', estimatedDuration: 25 }
  ],
  categories: [
    { categoryId: 'male-elite', name: 'Male Elite' },
    { categoryId: 'male-advanced', name: 'Male Advanced' },
    { categoryId: 'female-open', name: 'Female Open' }
  ],
  athletes: [
    // 12 male elite, 22 male advanced, 10 female
  ],
  maxDayHours: 10,
  stationsMode: 'SEQUENTIAL',
  athletesPerHeat: 8
};
```

### Generated Schedule Structure
```javascript
{
  eventId: "event-123",
  days: [{
    dayId: "day-1",
    sessions: [{
      sessionId: "day-1-wod-1-male-elite",
      wodId: "wod-1",
      categoryId: "male-elite", 
      startTime: "08:00",
      duration: 40, // 2 heats × 20min
      heats: [{
        heatId: "heat-1",
        athletes: [...], // 8 athletes
        stations: [{ athleteId, station: 1, lane: 1 }]
      }]
    }],
    totalDuration: 9.5,
    withinTimeLimit: true
  }]
}
```

## Time Calculation Logic

### Sequential Mode
```
Time per WOD per Category = ceil(athletes/athletesPerHeat) × wodDuration + transitions
Total Day Time = sum(all sessions) + lunch break
```

### Simultaneous Mode  
```
Time per WOD per Category = wodDuration + setup time
Total Day Time = sum(unique WOD times) + lunch break
```

## Frontend Integration

### React Component Usage
```jsx
import CompetitionScheduler from './components/CompetitionScheduler';

<CompetitionScheduler 
  eventId={eventId}
  onScheduleGenerated={(schedule) => {
    console.log('Schedule generated:', schedule);
  }}
/>
```

### Key Features
- Visual schedule timeline
- Drag-and-drop time adjustments
- Classification filter management
- Real-time validation of time constraints
- Export to PDF/Excel capabilities

## Best Practices

### 1. **Time Management**
- Always include buffer time between sessions (5-10 minutes)
- Account for equipment setup/breakdown
- Plan for delays and technical issues

### 2. **Classification Design**
- Start with broader elimination in early rounds
- Use progressive elimination (e.g., 16→8→4→2)
- Consider athlete experience levels

### 3. **Heat Organization**
- Balance skill levels within heats when possible
- Consider athlete warm-up requirements
- Plan for judge assignments

### 4. **Equipment Planning**
- Ensure sufficient stations for simultaneous mode
- Plan equipment transitions between WODs
- Consider space constraints

## Testing

Run the scheduler test script:
```bash
node scripts/test-scheduler.js
```

This creates sample data and demonstrates the scheduling algorithm with:
- 44 athletes across 3 categories
- 3 WODs with different durations
- Classification filters for elimination rounds
- Time constraint validation

## Future Enhancements

1. **AI-Powered Optimization**
   - Machine learning for optimal heat compositions
   - Predictive scheduling based on historical data

2. **Advanced Constraints**
   - Judge availability scheduling
   - Equipment resource management
   - Venue capacity optimization

3. **Real-Time Updates**
   - Live schedule adjustments during competition
   - Automatic delay propagation
   - Mobile notifications for athletes

4. **Integration Features**
   - Live streaming schedule coordination
   - Spectator information displays
   - Social media integration
