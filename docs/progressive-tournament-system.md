# Progressive Tournament System - DDD Implementation

## Overview

The enhanced DDD scheduler now supports dynamic progressive tournaments with flexible elimination rules, wildcard selection, and real-time integration with the Score domain.

## 🏆 Tournament Features

### **Dynamic Tournament Generation**
- Supports any number of athletes (8, 12, 16, 20, etc.)
- Flexible elimination rules defined by organizers
- Automatic bracket generation with optimal progression

### **Wildcard System**
- Score-based wildcard selection from eliminated athletes
- Configurable wildcard count per stage
- Integration with Score domain for performance-based selection

### **Real-time Progression**
- Automatic bracket updates after each stage
- Score integration for determining winners
- Live tournament status tracking

## 🔄 Tournament Flow

### **1. Initial Setup**
```javascript
// Generate tournament schedule
POST /scheduler/{eventId}
{
  "competitionMode": "VERSUS",
  "eliminationRules": [
    {
      "stage": 1,
      "from": 12,
      "to": 8,
      "wildcards": 2,
      "stageName": "Quarterfinals"
    },
    // ... more stages
  ]
}
```

### **2. Competition Execution**
1. Athletes compete in 1v1 matches
2. Scores submitted to Score domain
3. Results processed automatically

### **3. Stage Progression**
```javascript
// Process results after scores are submitted
POST /scheduler/{eventId}/{scheduleId}/process-results
{
  "filterId": "stage-1"
}

// Generate next stage schedule
POST /scheduler/{eventId}/{scheduleId}/next-stage
{
  "startTime": "14:00"
}
```

## 📊 Tournament Examples

### **12-Athlete Tournament**
```
Stage 1: 12 → 8 (6 winners + 2 wildcards)
Stage 2: 8 → 4 (4 direct winners)
Stage 3: 4 → 2 (2 direct winners)  
Stage 4: 2 → 1 (1 champion)
```

### **16-Athlete Tournament**
```
Stage 1: 16 → 8 (8 direct winners)
Stage 2: 8 → 4 (4 direct winners)
Stage 3: 4 → 2 (2 direct winners)
Stage 4: 2 → 1 (1 champion)
```

### **Custom 20-Athlete Tournament**
```
Stage 1: 20 → 12 (10 winners + 2 wildcards)
Stage 2: 12 → 8 (6 winners + 2 wildcards)
Stage 3: 8 → 4 (4 direct winners)
Stage 4: 4 → 1 (1 champion)
```

## 🏗️ DDD Architecture

### **Domain Entities**
- **Elimination**: Manages single tournament stage
- **ProgressiveTournament**: Orchestrates multi-stage tournament
- **Schedule**: Enhanced with tournament support

### **Domain Services**
- **VersusMode**: Enhanced with tournament progression
- **ScoreService**: Integration with Score domain

### **Value Objects**
- Tournament rules and stage configurations
- Match results and bracket state

## 📡 API Endpoints

### **Tournament Management**
```bash
# Generate tournament schedule
POST /scheduler/{eventId}

# Process stage results (after scores submitted)
POST /scheduler/{eventId}/{scheduleId}/process-results
Body: { "filterId": "stage-1" }

# Generate next tournament stage
POST /scheduler/{eventId}/{scheduleId}/next-stage
Body: { "startTime": "14:00" }

# Get tournament bracket
GET /scheduler/{eventId}/{scheduleId}/bracket
```

### **Tournament Events**
```javascript
// Published via EventBridge
{
  "eventType": "TournamentProgressed",
  "stage": 2,
  "stageName": "Semifinals", 
  "advancing": 4,
  "eliminated": 4,
  "tournamentComplete": false
}

{
  "eventType": "TournamentStageGenerated",
  "nextStage": 3,
  "matches": 2
}
```

## ✅ Key Benefits

### **For Organizers**
- **Flexible Rules**: Define custom elimination patterns
- **Real-time Updates**: Automatic bracket progression
- **Score Integration**: Wildcard selection based on performance
- **Audience Engagement**: Dramatic 1v1 format

### **For Athletes**
- **Clear Progression**: Easy to follow tournament structure
- **Fair Competition**: Direct head-to-head comparison
- **Second Chances**: Wildcard opportunities for strong performers

### **For Platform**
- **Scalable**: Handles tournaments of any size
- **Event-Driven**: Loose coupling with Score domain
- **DDD Compliant**: Proper domain separation
- **SaaS Ready**: Multi-tenant tournament support

## 🎯 Integration Points

### **Score Domain Integration**
- Automatic result processing from submitted scores
- Performance-based wildcard selection
- Real-time winner determination

### **Event-Driven Architecture**
- Tournament progression events
- Stage completion notifications
- Champion determination events

### **Multi-Tenant Support**
- Organization-scoped tournaments
- Isolated tournament data
- Role-based tournament management

## 🚀 Deployment Status

✅ **Deployed to Production**
- API Endpoint: `https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/scheduler/`
- Lambda ARN: `arn:aws:lambda:us-east-2:571340586587:function:CalisthenicsAppStack-SchedulerLambdaBF444921-wqE6d6gDi1j9`
- EventBridge Integration: Active
- Score Domain Integration: Active

The progressive tournament system is now **fully operational** and ready for dynamic one-vs-one competitions with flexible elimination rules! 🏆
