# Scoring System - Phase 2 Implementation Complete ✅

## What Was Implemented

### 1. Score Calculator Integration

#### Updated Scores Lambda
- Integrated `score-calculator.js` module
- Added `SCORING_SYSTEMS_TABLE` environment variable
- Enhanced POST `/scores` endpoint to:
  - Accept `scoringSystemId` and `rawData` in request body
  - Fetch scoring system configuration from DynamoDB
  - Calculate score using `calculateScore()` function
  - Store both calculated score and breakdown details

#### Enhanced Score Storage
```javascript
{
  eventId: "evt-123",
  scoreId: "score-1234567890",
  athleteId: "usr-456",
  wodId: "wod-789",
  score: 300,  // Calculated score
  scoringSystemId: "sys-advanced",
  rawData: {
    exercises: [
      { exerciseId: "ex-muscle-up-weighted", reps: 5, weight: 10, eqs: 4 }
    ],
    rank: 1
  },
  breakdown: {
    totalEDS: 290,
    timeBonus: 10,
    exercises: [...],
    formula: "Σ(EDS × EQS) + TB"
  }
}
```

### 2. Frontend Components

#### ScoringSystemManager.js
**Location:** `frontend/src/components/backoffice/ScoringSystemManager.js`

**Features:**
- Create/Delete scoring systems per event
- Toggle between Classic and Advanced modes
- Configure base score and decrement for Classic mode
- View all scoring systems for an event
- Color-coded badges (Green=Classic, Blue=Advanced)

**Usage:**
```jsx
<ScoringSystemManager eventId="evt-123" />
```

#### ExerciseLibraryManager.js
**Location:** `frontend/src/components/backoffice/ExerciseLibraryManager.js`

**Features:**
- View all 21 pre-seeded exercises
- Filter by category (Strength, Endurance, Skill)
- Display base scores and modifiers
- Color-coded categories
- Responsive grid layout

**Usage:**
```jsx
<ExerciseLibraryManager />
```

#### ScoreBreakdown.js
**Location:** `frontend/src/components/athlete/ScoreBreakdown.js`

**Features:**
- Display detailed score calculation
- Show formula used
- Exercise-by-exercise breakdown table
- Visual cards for EDS, Time Bonus, Final Score
- Rank display
- Fallback for classic scores (no breakdown)

**Usage:**
```jsx
<ScoreBreakdown score={scoreObject} />
```

### 3. API Integration

#### Score Submission with Calculation

**Classic Mode:**
```javascript
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

// Response: score = 98 (100 - (3-1) × 1)
```

**Advanced Mode:**
```javascript
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

// Response: score = 300 (140 + 150 + 10)
```

### 4. Calculation Examples

#### Example 1: Classic Scoring
```
Scoring System:
- Type: classic
- Base Score: 100
- Decrement: 1

Athlete finishes 3rd place:
Score = 100 - ((3 - 1) × 1) = 98 points
```

#### Example 2: Advanced Scoring
```
Scoring System:
- Type: advanced
- Exercises configured with base scores and modifiers
- Time bonuses: 1st=10, 2nd=7, 3rd=5

Athlete performs:
1. 5 Muscle Ups with 10kg weight (EQS: 4)
   - Base: 5 pts/rep
   - Weight: (10÷5) × 1 = 2 pts/rep
   - EDS: (5+2) × 5 = 35
   - Score: 35 × 4 = 140 pts

2. 30 Deadstop Push Ups (EQS: 5)
   - Base: 0.5 pts/rep
   - Deadstop: 0.5 pts/rep
   - EDS: (0.5+0.5) × 30 = 30
   - Score: 30 × 5 = 150 pts

3. Finishes 1st place
   - Time Bonus: 10 pts

Total: 140 + 150 + 10 = 300 points
```

## Architecture Highlights

✅ **Stateless Calculation**: Calculator is pure function, no side effects
✅ **Audit Trail**: Stores both raw data and calculated results
✅ **Backward Compatible**: Works with existing score submission (manual scores)
✅ **Flexible**: Supports both classic and advanced modes
✅ **Extensible**: Easy to add new exercise types and scoring formulas

## Integration Points

### Backoffice Flow
1. Organizer creates event
2. Organizer creates scoring system (Classic or Advanced)
3. Organizer creates WOD and links scoring system
4. Judge/Organizer enters athlete performance data
5. System calculates score automatically
6. Leaderboard updates with calculated scores

### Athlete Flow
1. Athlete views leaderboard
2. Clicks on score to see breakdown
3. ScoreBreakdown component shows:
   - Exercise-by-exercise details
   - EQS ratings
   - Time bonuses
   - Final calculated score

## Testing

### Test Scoring System Creation
```bash
TOKEN="your-jwt-token"
EVENT_ID="evt-123"

curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
        }
      ],
      "timeBonuses": {"1": 10, "2": 7, "3": 5}
    }
  }' \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/events/$EVENT_ID/scoring-systems
```

### Test Score Submission with Calculation
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-123",
    "athleteId": "usr-456",
    "wodId": "wod-789",
    "scoringSystemId": "sys-1234567890",
    "rawData": {
      "exercises": [
        {"exerciseId": "ex-muscle-up-weighted", "reps": 5, "weight": 10, "eqs": 4}
      ],
      "rank": 1
    }
  }' \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/scores
```

## Next Steps (Phase 3 - Optional)

1. **EventBridge Integration**
   - Emit `ScoreCalculated` events
   - Real-time leaderboard updates
   - Notifications to athletes

2. **Advanced Score Entry UI**
   - Form builder for exercise selection
   - EQS rating sliders (1-5)
   - Weight/reps input fields
   - Real-time score preview

3. **Leaderboard Enhancements**
   - Show breakdown on hover
   - Filter by scoring system
   - Export to CSV/PDF

4. **Analytics Dashboard**
   - Average EQS per exercise
   - Most common exercises
   - Score distribution charts

## Files Modified/Created

### Backend
- ✅ `lambda/scores.js` - Integrated calculator
- ✅ `lib/calisthenics-app-stack.ts` - Added SCORING_SYSTEMS_TABLE env var

### Frontend
- ✅ `frontend/src/components/backoffice/ScoringSystemManager.js` - New
- ✅ `frontend/src/components/backoffice/ExerciseLibraryManager.js` - New
- ✅ `frontend/src/components/athlete/ScoreBreakdown.js` - New

### Documentation
- ✅ `docs/scoring-system-phase2.md` - This document

## Deployment

```bash
# Backend
cd /home/labvel/projects/scoringames
cdk deploy --profile labvel-dev --require-approval never

# Frontend (when ready to integrate components)
cd frontend
npm run build
aws s3 sync build/ s3://calisthenics-app-571340586587 --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id E1MZ3OMBI2NDM3 --paths "/*" --profile labvel-dev
```

## Summary

Phase 2 is **COMPLETE** with:
- ✅ Score calculator fully integrated with scores Lambda
- ✅ Automatic score calculation on submission
- ✅ Detailed breakdown storage
- ✅ 3 new frontend components ready to use
- ✅ Backward compatible with manual score entry
- ✅ Full audit trail (raw data + calculated results)

The scoring system is now **production-ready** for both Classic and Advanced modes!
