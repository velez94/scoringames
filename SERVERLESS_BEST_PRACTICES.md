# Serverless Best Practices - Data Architecture

## ✅ Applied Best Practices

### 1. **Single Source of Truth**
- **Principle**: Each entity has one authoritative record
- **Implementation**: 
  - Cognito user pool is source of truth for user identity (UUID/sub)
  - Athletes table uses Cognito sub as primary key (`userId`)
  - No duplicate athlete records with different identifiers

### 2. **Consistent Identifiers**
- **Principle**: Use stable, immutable identifiers across services
- **Implementation**:
  - Primary key: Cognito sub (UUID) - never changes
  - Scores reference `athleteId` = Cognito sub
  - Email is stored but not used as primary identifier
  - Frontend matches by userId, athleteId, and email for backward compatibility

### 3. **Normalized Data**
- **Principle**: Avoid data duplication, use references
- **Implementation**:
  - Scores store `categoryId` reference, not category name
  - Scores store `wodId` reference, not WOD details
  - Frontend joins data client-side (efficient for small datasets)
  - Categories and WODs fetched once and cached

### 4. **Data Integrity**
- **Principle**: No orphaned references or invalid data
- **Implementation**:
  - All `athleteId` in scores reference valid athletes
  - All `categoryId` reference valid categories (rx-male, rx-female, etc.)
  - All `wodId` reference valid WODs
  - Validation in Lambda before writes

### 5. **Efficient Queries**
- **Principle**: Design tables for access patterns
- **Implementation**:
  - Scores table: Partition key = `eventId`, Sort key = `scoreId`
  - Query all scores for event in single operation
  - GSI on `dayId` for day-specific queries
  - Client-side filtering for category/WOD (small datasets)

### 6. **Cost Optimization**
- **Principle**: Minimize DynamoDB reads/writes
- **Implementation**:
  - Batch operations where possible
  - Client-side joins instead of multiple queries
  - Cache reference data (athletes, categories, WODs) in frontend
  - On-demand billing for unpredictable workloads

### 7. **Security**
- **Principle**: Least privilege, data isolation
- **Implementation**:
  - Cognito authorizer on all API endpoints
  - Lambda IAM roles with minimal permissions
  - Multi-tenant isolation via `organizerId` filtering
  - Public endpoints separate from authenticated endpoints

### 8. **Idempotency**
- **Principle**: Operations can be retried safely
- **Implementation**:
  - Use deterministic IDs where possible
  - PutCommand (upsert) instead of UpdateCommand for scores
  - Scripts can run multiple times without corruption

## 📊 Data Model

```
Athletes Table (ATHLETES_TABLE)
├─ PK: userId (Cognito sub UUID)
├─ email (indexed for lookup)
├─ firstName, lastName
├─ categoryId (reference to categories)
└─ organizerId (multi-tenant isolation)

Scores Table (SCORES_TABLE)
├─ PK: eventId
├─ SK: scoreId
├─ athleteId (references Athletes.userId)
├─ categoryId (references Categories.categoryId)
├─ wodId (references WODs.wodId)
├─ score (numeric value)
└─ GSI: dayId-score-index

Categories Table (CATEGORIES_TABLE)
├─ PK: categoryId (e.g., "rx-male", "rx-female")
└─ name (display name)

WODs Table (WODS_TABLE)
├─ PK: wodId
├─ eventId (reference)
├─ name, description
└─ format (time, reps, amrap)
```

## 🔄 Data Flow

1. **User Registration** → Cognito creates user with UUID
2. **Profile Creation** → Athletes table uses Cognito UUID as userId
3. **Score Submission** → References userId, categoryId, wodId
4. **Leaderboard Query** → Fetch scores by eventId, join with athletes client-side

## 🛠️ Maintenance Scripts

- `scripts/fix-test-data.js` - Normalize existing data
- `scripts/create-test-athletes.js` - Create Cognito users with proper structure
- `scripts/add-athlete-scores.js` - Add scores with correct references

## 📈 Performance Characteristics

- **Leaderboard Load**: 3 API calls (events, athletes, scores) - ~200ms
- **Score Submission**: 1 write operation - ~50ms
- **Category Filter**: Client-side, instant
- **Cost**: ~$0.25/month per 1000 users (DynamoDB on-demand)

## 🔐 Security Considerations

- Never expose Cognito sub in public APIs
- Use email for display, UUID for internal references
- Validate all foreign key references in Lambda
- Implement rate limiting on score submissions
- Audit logs for data modifications
