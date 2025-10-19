# Local Development Guide

## Quick Start

### 1. Setup Local Environment

```bash
# Install dependencies
npm install

# Start DynamoDB Local and create tables
npm run local:setup
```

This will:
- Start DynamoDB Local (port 8000)
- Start DynamoDB Admin UI (port 8001)
- Create all multi-tenant tables

### 2. Start Local API Server

```bash
npm run local:api
```

This starts a local HTTP server on port 3001 that simulates API Gateway + Lambda.

### 3. Test the API

```bash
# List competitions
curl http://localhost:3001/competitions

# Create competition (mocked as super admin)
curl -X POST http://localhost:3001/competitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Test Competition",
    "startDate": "2025-11-01",
    "endDate": "2025-11-03",
    "status": "upcoming"
  }'
```

### 4. View Data

Open DynamoDB Admin UI: http://localhost:8001

## Architecture

### Local Stack

```
┌─────────────────────────────────────────┐
│  Frontend (React)                       │
│  http://localhost:3000                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Local API Server                       │
│  http://localhost:3001                  │
│  (Simulates API Gateway)                │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   ┌────▼────┐   ┌───▼────┐
   │Competi- │   │Events  │
   │tions.js │   │.js     │
   └────┬────┘   └───┬────┘
        │            │
        └──────┬─────┘
               ▼
┌─────────────────────────────────────────┐
│  DynamoDB Local                         │
│  http://localhost:8000                  │
└─────────────────────────────────────────┘
```

### Local API Server

The `scripts/local-api.js` server:
- Routes requests to appropriate Lambda handlers
- Mocks API Gateway event structure
- Mocks Cognito authentication (super admin by default)
- Supports CORS for frontend development

### Environment Variables

Local Lambda handlers automatically detect local environment:

```javascript
// In lambda/competitions.js
const clientConfig = process.env.DYNAMODB_ENDPOINT 
  ? { endpoint: process.env.DYNAMODB_ENDPOINT, region: 'us-east-2' }
  : {};
```

## Development Workflow

### 1. Modify a Microservice

```bash
# Edit handler
vim lambda/competitions.js

# Restart API server (Ctrl+C then restart)
npm run local:api
```

No build step needed - Node.js loads changes on restart.

### 2. Test Changes

```bash
# Test endpoint
curl http://localhost:3001/competitions

# Or use your frontend
cd frontend && npm start
```

### 3. View Logs

The local API server logs all requests:

```
🚀 Local API Server running
📍 http://localhost:3001

GET /competitions → /competitions
POST /competitions → /competitions
```

### 4. Inspect Data

Open http://localhost:8001 to view/edit DynamoDB data.

## Mock Authentication

The local API server mocks Cognito authentication:

```javascript
requestContext: {
  authorizer: {
    claims: {
      sub: 'local-user-123',
      email: 'dev@local.com',
      'custom:isSuperAdmin': 'true', // Always super admin locally
    }
  }
}
```

To test different user roles, modify `scripts/local-api.js`.

## Seeding Data

### Create Sample Competition

```bash
npm run seed:local
```

Or manually:

```bash
curl -X POST http://localhost:3001/competitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Games 2025",
    "startDate": "2025-06-01",
    "endDate": "2025-06-03",
    "status": "upcoming",
    "description": "Annual summer competition"
  }'
```

## Troubleshooting

### DynamoDB Local not starting

```bash
# Stop and remove containers
npm run local:stop

# Remove data directory
rm -rf localstack/dynamodb

# Setup again
npm run local:setup
```

### Port already in use

```bash
# Check what's using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Tables not created

```bash
# List tables
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 \
  --region us-east-2

# Recreate tables
npm run local:setup
```

### Lambda handler errors

Check the local API server console for error logs.

## Available Commands

```bash
# Setup
npm run local:setup      # Create tables
npm run local:start      # Start DynamoDB only
npm run local:stop       # Stop all containers

# Development
npm run local:api        # Start local API server
npm run seed:local       # Seed sample data

# Utilities
npm run build            # Build CDK (not needed for local dev)
npm test                 # Run tests
```

## Differences from AWS

### What Works Locally
✅ DynamoDB operations (CRUD, queries, GSIs)  
✅ Lambda handler logic  
✅ Multi-tenant data isolation  
✅ API routing  

### What Doesn't Work Locally
❌ Cognito authentication (mocked)  
❌ EventBridge (leaderboard calculator)  
❌ S3 (event images)  
❌ CloudFront  

### Workarounds

**EventBridge:** Call leaderboard calculator directly:
```javascript
const calculator = require('./lambda/leaderboard-calculator');
await calculator.handler({ detail: { competitionId, eventId } });
```

**S3:** Use local filesystem or skip image upload in local dev.

## Frontend Configuration

Update frontend API endpoint for local development:

```javascript
// frontend/src/config.js
const API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'
  : 'https://5p9ja0yat5.execute-api.us-east-2.amazonaws.com/prod';
```

## Next Steps

1. ✅ Local environment running
2. Implement business logic in microservices
3. Test locally
4. Deploy to AWS: `npm run deploy`

## Tips

- Keep DynamoDB Admin UI open to inspect data
- Use `console.log()` liberally in Lambda handlers
- Restart local API server after code changes
- Use Postman/Insomnia for API testing
- Frontend hot-reloads automatically
