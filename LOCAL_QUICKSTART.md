# Local Development - Quick Reference

## 🚀 Start Development

```bash
# 1. Setup (first time only)
npm run local:setup

# 2. Start API server
npm run local:api

# 3. In another terminal, start frontend
cd frontend && npm start
```

## 📍 URLs

- **API:** http://localhost:3001
- **Frontend:** http://localhost:3000
- **DynamoDB Admin:** http://localhost:8001
- **DynamoDB Endpoint:** http://localhost:8000

## 🧪 Test API

```bash
# List competitions
curl http://localhost:3001/competitions

# Create competition
curl -X POST http://localhost:3001/competitions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Competition","startDate":"2025-11-01","endDate":"2025-11-03","status":"upcoming"}'

# Test other services
curl http://localhost:3001/events
curl http://localhost:3001/scores
curl http://localhost:3001/categories
curl http://localhost:3001/wods
curl http://localhost:3001/me
```

## 📁 Project Structure

```
lambda/
  ├── competitions.js    # /competitions/*
  ├── events.js          # /events/*
  ├── scores.js          # /scores/*
  ├── categories.js      # /categories/*
  ├── wods.js            # /wods/*
  └── users.js           # /me/* and /users/*

scripts/
  ├── local-api.js       # Local API server
  └── setup-local.sh     # Setup script

docker-compose.yml       # DynamoDB Local
```

## 🔄 Development Workflow

1. **Edit Lambda handler** (e.g., `lambda/competitions.js`)
2. **Restart API server** (Ctrl+C, then `npm run local:api`)
3. **Test changes** (curl or frontend)
4. **View data** (http://localhost:8001)

## 🛠️ Common Commands

```bash
# Setup & Start
npm run local:setup      # Create tables (first time)
npm run local:start      # Start DynamoDB only
npm run local:api        # Start API server

# Stop
npm run local:stop       # Stop DynamoDB
Ctrl+C                   # Stop API server

# Utilities
npm run seed:local       # Add sample data
npm run build            # Build CDK
npm run deploy           # Deploy to AWS
```

## 🐛 Troubleshooting

### Port 3001 in use
```bash
lsof -i :3001
kill -9 <PID>
```

### DynamoDB not responding
```bash
npm run local:stop
npm run local:setup
```

### Tables missing
```bash
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-2
npm run local:setup
```

## 🎯 Mock User

Local API mocks authentication as super admin:
- **User ID:** local-user-123
- **Email:** dev@local.com
- **Role:** Super Admin

To change, edit `scripts/local-api.js`.

## 📊 View Data

Open http://localhost:8001 to:
- Browse tables
- View items
- Edit data
- Run queries

## 🚢 Deploy to AWS

```bash
npm run build
npm run deploy
```

## 📚 Full Documentation

See `LOCAL_DEVELOPMENT.md` for complete guide.
