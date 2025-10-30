# Scoring System - Quick Reference Guide

## 🎯 Overview

The ScorinGames platform now supports two scoring modes:

1. **Classic Mode**: Rank-based scoring (100, 99, 98...)
2. **Advanced Mode**: Exercise-based scoring with quality ratings (EDS × EQS + TB)

## 📊 API Endpoints

### Scoring Systems
```
POST   /events/{eventId}/scoring-systems    Create scoring system
GET    /events/{eventId}/scoring-systems    List scoring systems
GET    /events/{eventId}/scoring-systems/{id}    Get scoring system
PUT    /events/{eventId}/scoring-systems/{id}    Update scoring system
DELETE /events/{eventId}/scoring-systems/{id}    Delete scoring system
```

### Exercise Library
```
GET    /exercises           List all exercises (21 pre-seeded)
POST   /exercises           Create custom exercise
GET    /exercises/{id}      Get exercise details
PUT    /exercises/{id}      Update exercise
DELETE /exercises/{id}      Delete exercise
```

### Score Submission
```
POST   /scores              Submit score with automatic calculation
```

## 🔧 Usage Examples

### 1. Create Classic Scoring System
```json
POST /events/evt-123/scoring-systems
{
  "name": "Classic Ranking",
  "type": "classic",
  "config": {
    "baseScore": 100,
    "decrement": 1
  }
}
```

### 2. Create Advanced Scoring System
```json
POST /events/evt-123/scoring-systems
{
  "name": "Advanced Calisthenics",
  "type": "advanced",
  "config": {
    "exercises": [
      {
        "exerciseId": "ex-muscle-up-weighted",
        "name": "Muscle Up (Weighted)",
        "baseScore": 5,
        "modifiers": [
          {"type": "weight", "unit": "kg", "increment": 5, "points": 1}
        ]
      },
      {
        "exerciseId": "ex-push-ups-deadstop",
        "name": "Push Ups (Deadstop)",
        "baseScore": 0.5,
        "modifiers": [
          {"type": "deadstop", "points": 0.5}
        ]
      }
    ],
    "timeBonuses": {
      "1": 10,
      "2": 7,
      "3": 5
    }
  }
}
```

### 3. Submit Score (Classic Mode)
```json
POST /scores
{
  "eventId": "evt-123",
  "athleteId": "usr-456",
  "wodId": "wod-789",
  "scoringSystemId": "sys-classic",
  "rawData": {
    "rank": 3
  }
}

// Calculated: 100 - ((3-1) × 1) = 98 points
```

### 4. Submit Score (Advanced Mode)
```json
POST /scores
{
  "eventId": "evt-123",
  "athleteId": "usr-456",
  "wodId": "wod-789",
  "scoringSystemId": "sys-advanced",
  "rawData": {
    "exercises": [
      {
        "exerciseId": "ex-muscle-up-weighted",
        "reps": 5,
        "weight": 10,
        "eqs": 4
      },
      {
        "exerciseId": "ex-push-ups-deadstop",
        "reps": 30,
        "deadstop": true,
        "eqs": 5
      }
    ],
    "rank": 1,
    "completedInTime": true
  }
}

// Calculated: 300 points (140 + 150 + 10)
```

## 🏋️ Pre-Seeded Exercises (21 Total)

### Strength (8)
- Muscle Up (Bodyweight) - 5 pts
- Muscle Up (Weighted) - 5 pts + weight bonus
- Pull Up (Bodyweight) - 1 pt
- Pull Up (Weighted) - 1 pt + weight bonus
- Bar Dips (Bodyweight) - 1 pt
- Bar Dips (Weighted) - 1 pt + weight bonus
- Squats (Weighted) - 0.5 pt + weight bonus
- Pistol Squats (Weighted) - 1.5 pts + weight bonus

### Endurance (6)
- Push Ups (Bodyweight) - 0.5 pt
- Push Ups (Deadstop) - 0.5 pt + deadstop bonus
- Squats (Bodyweight) - 0.5 pt
- Burpees - 1 pt
- Zancadas Burpees - 2 pts
- Chin Over Bar Hold - 2 pts per 10s

### Skill (7)
- Pistol Squats (Bodyweight) - 1.5 pts
- Handstand Hold - 2 pts per 10s
- Handstand Push Up - 4 pts
- Front Lever Hold - 3 pts per 10s
- One Arm Pull Up - 8 pts
- Leg Raiser Muscle Up - 6 pts
- L-Sit Hold - 2 pts per 10s

## 📱 Frontend Components

### ScoringSystemManager
```jsx
import ScoringSystemManager from './components/backoffice/ScoringSystemManager';

<ScoringSystemManager eventId="evt-123" />
```

### ExerciseLibraryManager
```jsx
import ExerciseLibraryManager from './components/backoffice/ExerciseLibraryManager';

<ExerciseLibraryManager />
```

### ScoreBreakdown
```jsx
import ScoreBreakdown from './components/athlete/ScoreBreakdown';

<ScoreBreakdown score={scoreObject} />
```

## 🧮 Calculation Formulas

### Classic Mode
```
Score = BaseScore - ((Rank - 1) × Decrement)

Example:
- Base: 100
- Decrement: 1
- Rank: 3
- Score: 100 - ((3-1) × 1) = 98
```

### Advanced Mode
```
Total Score = Σ(EDS × EQS) + TB

Where:
- EDS = Exercise Difficulty Score (base + modifiers)
- EQS = Execution Quality Score (1-5 scale)
- TB = Time Bonus (based on rank)

Example:
Exercise 1: 5 Muscle Ups @ 10kg, EQS=4
  EDS = (5 + 2) × 5 = 35
  Score = 35 × 4 = 140

Exercise 2: 30 Deadstop Push Ups, EQS=5
  EDS = (0.5 + 0.5) × 30 = 30
  Score = 30 × 5 = 150

Time Bonus (1st place) = 10

Total = 140 + 150 + 10 = 300 points
```

## 🔐 Authorization

All endpoints require Cognito JWT token:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/exercises
```

## 📦 Database Schema

### ScoringSystemsTable
```
PK: eventId
SK: scoringSystemId
Attributes: name, type, config, createdBy, createdAt
```

### ExerciseLibraryTable
```
PK: exerciseId
Attributes: name, category, baseScore, modifiers, isGlobal
```

### ScoresTable (Enhanced)
```
PK: eventId
SK: scoreId
Attributes: 
  - score (calculated)
  - scoringSystemId
  - rawData (input)
  - breakdown (calculation details)
  - athleteId, wodId, etc.
```

## 🚀 Deployment

```bash
# Backend
cdk deploy --profile labvel-dev --require-approval never

# Frontend
cd frontend && npm run build
aws s3 sync build/ s3://calisthenics-app-571340586587 --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id E1MZ3OMBI2NDM3 --paths "/*" --profile labvel-dev
```

## ✅ Status

- ✅ Phase 1: Core Infrastructure (Tables, Lambdas, API)
- ✅ Phase 2: Calculator Integration & Frontend Components
- 🔄 Phase 3: EventBridge & Advanced UI (Optional)
