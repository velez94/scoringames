# Lambda Reorganization Deployment Guide

## Pre-Deployment Checklist

✅ All domain packages created
✅ Dependencies installed for all packages
✅ Import paths updated
✅ CDK stacks updated
✅ All packages verified and loading correctly

## Deployment Steps

### 1. Verify CDK Synth
```bash
cd /home/labvel/projects/scoringames
cdk synth --profile labvel-dev
```

This will validate all CDK stacks can synthesize correctly with the new Lambda paths.

### 2. Deploy All Stacks
```bash
cdk deploy --all --profile labvel-dev
```

Or deploy stacks individually:

```bash
# Deploy in order
cdk deploy ScorinGames/Shared --profile labvel-dev
cdk deploy ScorinGames/Network --profile labvel-dev
cdk deploy ScorinGames/Organizations --profile labvel-dev
cdk deploy ScorinGames/Competitions --profile labvel-dev
cdk deploy ScorinGames/Athletes --profile labvel-dev
cdk deploy ScorinGames/Scoring --profile labvel-dev
cdk deploy ScorinGames/Scheduling --profile labvel-dev
cdk deploy ScorinGames/Categories --profile labvel-dev
cdk deploy ScorinGames/WODs --profile labvel-dev
```

### 3. Verify Deployment

#### Check Lambda Functions
```bash
aws lambda list-functions --profile labvel-dev --region us-east-2 \
  --query 'Functions[?contains(FunctionName, `ScorinGames`)].FunctionName'
```

#### Test API Endpoints
```bash
# Get JWT token first
TOKEN="your-jwt-token"

# Test competitions
curl -H "Authorization: Bearer $TOKEN" \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/competitions?organizationId=org-xxx

# Test athletes
curl -H "Authorization: Bearer $TOKEN" \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/athletes

# Test scoring
curl -H "Authorization: Bearer $TOKEN" \
  https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/exercises

# Test public endpoints (no auth)
curl https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod/public/events
```

#### Check CloudWatch Logs
```bash
# View recent logs for competitions
aws logs tail /aws/lambda/ScorinGames-CompetitionsLambda-xxx \
  --follow --profile labvel-dev

# Check for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/ScorinGames-CompetitionsLambda-xxx \
  --filter-pattern "ERROR" \
  --profile labvel-dev
```

## Expected Changes

### Lambda Function Updates
Each Lambda function will be updated with:
- New code package from domain-specific directory
- Updated handler name (e.g., `index.handler` instead of `competitions.handler`)
- Same environment variables and permissions

### No Breaking Changes
- API endpoints remain the same
- Environment variables unchanged
- IAM permissions unchanged
- Database tables unchanged

## Rollback Plan

If issues occur:

### 1. Quick Rollback (Revert CDK Changes)
```bash
git revert HEAD
cdk deploy --all --profile labvel-dev
```

### 2. Manual Rollback (Restore Previous Version)
```bash
# Restore previous Lambda code structure
git checkout HEAD~1 lambda/
git checkout HEAD~1 infrastructure/

# Redeploy
cdk deploy --all --profile labvel-dev
```

### 3. Emergency Rollback (AWS Console)
1. Go to Lambda console
2. Select affected function
3. Click "Versions" tab
4. Publish new version from previous code
5. Update alias to point to previous version

## Post-Deployment Verification

### Functional Tests
- [ ] Create new event
- [ ] Register athlete for event
- [ ] Submit score
- [ ] View leaderboard
- [ ] Generate schedule
- [ ] Create WOD
- [ ] Create category

### Performance Tests
- [ ] Check Lambda cold start times
- [ ] Verify API response times
- [ ] Monitor error rates in CloudWatch

### Integration Tests
- [ ] EventBridge events flowing correctly
- [ ] Cross-domain communication working
- [ ] Authorization checks functioning

## Monitoring

### CloudWatch Dashboards
Monitor these metrics for 24 hours post-deployment:
- Lambda invocation count
- Lambda error rate
- Lambda duration
- API Gateway 4xx/5xx errors
- DynamoDB throttling

### Alerts to Watch
- Lambda errors > 1%
- API Gateway 5xx errors > 0.5%
- Lambda duration > 10s
- DynamoDB throttling > 0

## Success Criteria

✅ All Lambda functions deployed successfully
✅ All API endpoints responding correctly
✅ No increase in error rates
✅ No performance degradation
✅ All functional tests passing
✅ CloudWatch logs showing correct execution

## Cleanup (Optional - After 7 Days)

Once deployment is stable:

```bash
# Remove root lambda package.json and node_modules
cd /home/labvel/projects/scoringames/lambda
rm package.json package-lock.json
rm -rf node_modules

# Remove legacy scheduler directory
rm -rf scheduler

# Commit cleanup
git add .
git commit -m "Clean up legacy Lambda structure"
```

## Support

If issues arise:
1. Check CloudWatch logs for specific errors
2. Verify environment variables are set correctly
3. Confirm IAM permissions are intact
4. Test individual Lambda functions in AWS console
5. Review deployment logs for CDK errors

## Notes

- **Deployment Time**: ~10-15 minutes for all stacks
- **Downtime**: Zero downtime deployment (Lambda versioning)
- **Risk Level**: Low (code organization only, no logic changes)
- **Rollback Time**: ~5 minutes if needed
