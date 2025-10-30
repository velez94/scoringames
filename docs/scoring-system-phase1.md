# Scoring System - Phase 1 Implementation Complete ✅

## What Was Implemented

### 1. Database Tables (DynamoDB)

#### ScoringSystemsTable
- **PK**: `eventId`
- **SK**: `scoringSystemId`
- **Purpose**: Store scoring system configurations per event
- **Attributes**:
  - `name`: "Classic" | "Advanced Calisthenics"
  - `type`: "classic" | "advanced"
  - `config`: JSON configuration object
  - `createdBy`, `createdAt`

#### ExerciseLibraryTable
- **PK**: `exerciseId`
- **Purpose**: Global exercise definitions library
- **Attributes**:
  - `name`: Exercise name
  - `category`: "strength" | "endurance" | "skill"
  - `baseScore`: Base points per rep/hold
  - `modifiers`: Array of modifiers (weight, deadstop, hold)
  - `isGlobal`: Boolean (shared across events)
  - `createdBy`, `createdAt`

**Seeded with 21 exercises:**
- Muscle Ups (bodyweight & weighted)
- Pull Ups (bodyweight & weighted)
- Bar Dips (bodyweight & weighted)
- Push Ups (bodyweight & deadstop)
- Squats (bodyweight & weighted)
- Pistol Squats (bodyweight & weighted)
- Handstand Hold & Push Ups
- Front Lever Hold
- Chin Over Bar Hold
- One Arm Pull Up
- Leg Raiser Muscle Up
- Burpees & Zancadas Burpees
- L-Sit Hold

### 2. Lambda Functions (Microservices)

#### scoring-systems.js
**Endpoints:**
- `POST /events/{eventId}/scoring-systems` - Create scoring system
- `GET /events/{eventId}/scoring-systems` - List scoring systems
- `GET /events/{eventId}/scoring-systems/{id}` - Get scoring system
- `PUT /events/{eventId}/scoring-systems/{id}` - Update scoring system
- `DELETE /events/{eventId}/scoring-systems/{id}` - Delete scoring system

#### exercise-library.js
**Endpoints:**
- `GET /exercises` - List all exercises
- `POST /exercises` - Create custom exercise
- `GET /exercises/{id}` - Get exercise details
- `PUT /exercises/{id}` - Update exercise
- `DELETE /exercises/{id}` - Delete exercise

#### score-calculator.js
**Purpose**: Stateless calculation engine (pure function)

**Functions:**
- `calculateScore(rawData, scoringSystem)` - Main calculation function
- `calculateClassicScore(rawData, config)` - Classic ranking-based scoring
- `calculateAdvancedScore(rawData, config)` - Advanced EDS × EQS + TB scoring

**Classic Formula:**
```
Score = BaseScore - ((Rank - 1) × Decrement)
Example: 100 - ((3 - 1) × 1) = 98 points for 3rd place
```

**Advanced Formula:**
```
Total Score = Σ(EDS × EQS) + TB

Where:
- EDS = Exercise Difficulty Score (base + modifiers)
- EQS = Execution Quality Score (1-5 scale)
- TB = Time Bonus (based on rank/completion)
```

### 3. API Gateway Routes

```
GET    /exercises
POST   /exercises
GET    /exercises/{id}
PUT    /exercises/{id}
DELETE /exercises/{id}

POST   /events/{eventId}/scoring-systems
GET    /events/{eventId}/scoring-systems
GET    /events/{eventId}/scoring-systems/{id}
PUT    /events/{eventId}/scoring-systems/{id}
DELETE /events/{eventId}/scoring-systems/{id}
```

### 4. Scoring System Types

#### Classic Mode
```json
{
  "type": "classic",
  "config": {
    "baseScore": 100,
    "decrement": 1
  }
}
```

#### Advanced Mode
```json
{
  "type": "advanced",
  "config": {
    "exercises": [
      {
        "exerciseId": "ex-muscle-up-weighted",
        "name": "Muscle Up (Weighted)",
        "baseScore": 5,
        "modifiers": [
          { "type": "weight", "unit": "kg", "increment": 5, "points": 1 }
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

## Example Calculation (Advanced Mode)

### Input Data:
```json
{
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
```

### Calculation:
```
Muscle Ups:
- Base: 5 pts/rep
- Weight bonus: (10kg ÷ 5) × 1 = 2 pts/rep
- EDS: (5 + 2) × 5 reps = 35
- EQS: 4
- Score: 35 × 4 = 140 pts

Deadstop Push Ups:
- Base: 0.5 pts/rep
- Deadstop bonus: 0.5 pts/rep
- EDS: (0.5 + 0.5) × 30 reps = 30
- EQS: 5
- Score: 30 × 5 = 150 pts

Time Bonus (1st place): 10 pts

Total: 140 + 150 + 10 = 300 pts
```

## Architecture Highlights

✅ **Bounded Context Isolation**: Scoring domain is separate from Competitions/Athletes
✅ **Stateless Calculation**: Calculator Lambda is pure function (testable, scalable)
✅ **Event-Scoped Configuration**: Each event can have multiple scoring systems
✅ **Global Exercise Library**: Shared exercises across all events
✅ **Extensible Design**: Easy to add new exercise types and modifiers
✅ **Audit Trail Ready**: Stores both raw data and calculated results

## Next Steps (Phase 2)

1. **Update Scores Lambda** to use score-calculator
2. **Enhance ScoresTable** to store:
   - `scoringSystemId`
   - `rawData` (exercises, reps, weights, eqs)
   - `calculatedScore`
   - `breakdown` (detailed calculation)
3. **Frontend Components**:
   - `ScoringSystemManager.js` - CRUD scoring systems
   - `ExerciseLibraryManager.js` - Manage exercises
   - `ScoreEntryAdvanced.js` - Advanced score entry form
4. **EventBridge Integration** for real-time leaderboard updates

## Testing

### Test Exercise Library
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/exercises
```

### Create Scoring System
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Advanced Calisthenics",
    "type": "advanced",
    "config": {
      "exercises": [...],
      "timeBonuses": {"1": 10, "2": 7, "3": 5}
    }
  }' \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/events/evt-123/scoring-systems
```

## Deployment

```bash
cd /home/labvel/projects/scoringames
cdk deploy --profile labvel-dev --require-approval never

# Seed exercise library
AWS_PROFILE=labvel-dev node scripts/seed-exercises.js
```

## Files Created

- `lambda/scoring-systems.js` - Scoring systems CRUD
- `lambda/exercise-library.js` - Exercise library CRUD
- `lambda/score-calculator.js` - Calculation engine
- `scripts/seed-exercises.js` - Exercise library seeder
- `docs/scoring-system-phase1.md` - This document

## Database Tables Created

- `CalisthenicsAppStack-ScoringSystemsTable...` - Scoring configurations
- `CalisthenicsAppStack-ExerciseLibraryTable...` - Exercise definitions (21 exercises seeded)
