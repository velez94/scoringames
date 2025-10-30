# Lambda Domain Packages

## Structure

Lambda code is organized into domain-specific packages following DDD bounded contexts:

```
lambda/
├── shared/                    # Shared utilities and helpers
│   ├── utils/
│   │   ├── auth.js           # JWT verification, RBAC helpers
│   │   └── logger.js         # Structured logging
│   ├── analytics.js          # Analytics aggregation
│   ├── get-event-data.js     # Event data fetcher
│   ├── leaderboard-calculator.js  # Legacy leaderboard
│   └── package.json
│
├── competitions/              # Competitions Domain
│   ├── index.js              # Main handler (competitions.handler)
│   ├── events.js             # Events CRUD
│   ├── eventbridge-handler.js # Event consumer
│   └── package.json
│
├── organizations/             # Organizations Domain
│   ├── index.js              # Main handler (organizations.handler)
│   └── package.json
│
├── athletes/                  # Athletes Domain
│   ├── index.js              # Main handler (users.handler)
│   ├── eventbridge-handler.js # Event consumer
│   ├── get-data.js           # Athlete data fetcher
│   └── package.json
│
├── scoring/                   # Scoring Domain
│   ├── index.js              # Scores handler
│   ├── systems.js            # Scoring systems CRUD
│   ├── exercises.js          # Exercise library
│   ├── calculator.js         # Score calculation engine
│   ├── leaderboard-api.js    # Leaderboard API
│   ├── leaderboard-calculator.js  # Real-time calculator
│   └── package.json
│
├── scheduling/                # Scheduling Domain
│   ├── index.js              # Scheduler handler (legacy)
│   ├── ddd-handler.js        # DDD scheduler
│   ├── stepfunctions.js      # Step Functions integration
│   ├── generate.js           # Schedule generation
│   ├── sessions.js           # Session management
│   ├── public.js             # Public schedules
│   ├── public-ddd.js         # DDD public schedules
│   ├── tournament-*.js       # Tournament handlers
│   ├── leaderboard-integration.js  # Leaderboard integration
│   ├── domain-old/           # Legacy scheduler domain
│   └── package.json
│
├── categories/                # Categories Domain
│   ├── index.js              # Main handler
│   ├── eventbridge-handler.js # Event consumer
│   ├── get-data.js           # Category data fetcher
│   └── package.json
│
└── wods/                      # WODs Domain
    ├── index.js              # Main handler
    ├── eventbridge-handler.js # Event consumer
    ├── get-data.js           # WOD data fetcher
    └── package.json
```

## Package Dependencies

Each domain package has its own `package.json` with minimal dependencies:

- **@aws-sdk/client-dynamodb**: DynamoDB client
- **@aws-sdk/lib-dynamodb**: DynamoDB document client
- **@aws-sdk/client-eventbridge**: EventBridge client (where needed)
- **@aws-sdk/client-s3**: S3 client (competitions only)
- **@aws-sdk/s3-request-presigner**: Presigned URLs (competitions only)

## Import Patterns

### Shared Utilities
```javascript
const logger = require('../shared/utils/logger');
const { verifyToken, checkOrgAccess } = require('../shared/utils/auth');
```

### Cross-Domain Communication
Use EventBridge, not direct imports:
```javascript
// ❌ Don't do this
const { getAthletes } = require('../athletes/index');

// ✅ Do this instead
await eventBridge.send(new PutEventsCommand({
  Entries: [{
    Source: 'competitions.domain',
    DetailType: 'EventCreated',
    Detail: JSON.stringify({ eventId, ... })
  }]
}));
```

## CDK Stack Configuration

Each domain stack points to its package:

```typescript
const lambda = new lambda.Function(this, 'CompetitionsLambda', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/competitions'),
  // ...
});
```

## Development Workflow

### Adding a New Handler
1. Create handler file in appropriate domain package
2. Update domain's `package.json` if new dependencies needed
3. Run `npm install` in domain directory
4. Update CDK stack to reference new handler
5. Deploy: `cdk deploy ScorinGames/{DomainStack}`

### Installing Dependencies
```bash
# Install for specific domain
cd lambda/competitions
npm install <package>

# Install for all domains
cd lambda
for dir in */; do (cd "$dir" && npm install); done
```

### Testing Locally
```bash
# Test specific domain
cd lambda/competitions
node -e "const handler = require('./index'); handler.handler({...})"
```

## Benefits

### Independent Deployment
- Each domain can be deployed independently
- Faster CI/CD pipelines
- Reduced blast radius for changes

### Clear Boundaries
- Domain logic stays within bounded context
- No accidental cross-domain coupling
- Easier to understand and maintain

### Team Scalability
- Teams can own specific domains
- Parallel development without conflicts
- Clear ownership and responsibility

### Better Testing
- Test domains in isolation
- Mock cross-domain dependencies via EventBridge
- Faster test execution

## Migration Notes

This structure was created from the original flat `lambda/` directory. Key changes:

1. **Moved files**: All handlers moved to domain packages
2. **Updated imports**: Changed `./utils/` to `../shared/utils/`
3. **Updated CDK**: All stacks now reference domain packages
4. **Installed deps**: Each package has its own `node_modules`

## Legacy Files

Some files remain in root `lambda/` directory for backward compatibility:
- `package.json` - Root package (can be removed after full migration)
- `node_modules/` - Root dependencies (can be removed after full migration)

These can be safely removed once all references are updated.
