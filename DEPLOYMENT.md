# Deployment Guide

## Quick Deploy

### Deploy Everything (Infrastructure + Frontend)

```bash
export AWS_PROFILE=labvel-dev
npm run deploy:all
```

This will:
1. Build CDK TypeScript
2. Deploy infrastructure (Lambda, DynamoDB, API Gateway, etc.)
3. Build React frontend
4. Upload to S3
5. Invalidate CloudFront cache

### Deploy Infrastructure Only

```bash
export AWS_PROFILE=labvel-dev
npm run build
npm run deploy
```

### Deploy Frontend Only

```bash
export AWS_PROFILE=labvel-dev
npm run deploy:frontend
```

This will:
1. Get stack outputs (API URL, User Pool, etc.)
2. Update `.env.production`
3. Build React app
4. Upload to S3
5. Create CloudFront invalidation

## Manual Deployment

### 1. Deploy Infrastructure

```bash
export AWS_PROFILE=labvel-dev

# Build CDK
npm run build

# Preview changes
cdk diff

# Deploy
cdk deploy
```

### 2. Deploy Frontend

```bash
# Get stack outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# Update .env.production
cat > frontend/.env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=us-east-2
REACT_APP_ENV=production
EOF

# Build
cd frontend
npm run build
cd ..

# Upload to S3
BUCKET=$(aws s3 ls | grep calisthenics-app | awk '{print $3}')
aws s3 sync frontend/build/ s3://$BUCKET/ --delete

# Invalidate CloudFront
DISTRIBUTION_ID=$(aws cloudformation describe-stack-resources \
  --stack-name CalisthenicsAppStack \
  --query "StackResources[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and tested locally
- [ ] All tests passing: `npm test`
- [ ] CDK builds successfully: `npm run build`
- [ ] Preview changes: `cdk diff`
- [ ] Backup important data (if any)

### Deployment

- [ ] Deploy infrastructure: `npm run deploy`
- [ ] Verify stack outputs
- [ ] Create super admin (first time): `npm run create-admin`
- [ ] Deploy frontend: `npm run deploy:frontend`
- [ ] Wait for CloudFront invalidation (1-2 minutes)

### Post-Deployment

- [ ] Test API endpoints
- [ ] Test frontend login
- [ ] Verify microservices working
- [ ] Check CloudWatch logs for errors
- [ ] Monitor Lambda metrics

## Stack Outputs

After deployment, get important values:

```bash
# All outputs
aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs'

# Specific values
API_URL=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
  --output text)

echo "API: $API_URL"
echo "Website: https://$CLOUDFRONT_URL"
```

## Environment-Specific Deployments

### Development

```bash
export AWS_PROFILE=labvel-dev
npm run deploy:all
```

### Staging (if you have it)

```bash
export AWS_PROFILE=labvel-staging
cdk deploy --context environment=staging
npm run deploy:frontend
```

### Production

```bash
export AWS_PROFILE=labvel-prod
cdk deploy --context environment=production --require-approval broadening
npm run deploy:frontend
```

## Rollback

### Infrastructure Rollback

```bash
# Revert to previous CDK code
git revert HEAD

# Rebuild and deploy
npm run build
npm run deploy
```

### Frontend Rollback

```bash
# Checkout previous version
git checkout HEAD~1 frontend/

# Redeploy
npm run deploy:frontend
```

## Troubleshooting

### CloudFormation Stack Failed

```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name CalisthenicsAppStack \
  --max-items 20

# Continue rollback if stuck
aws cloudformation continue-update-rollback \
  --stack-name CalisthenicsAppStack
```

### Frontend Not Updating

```bash
# Check S3 upload
aws s3 ls s3://calisthenics-app-571340586587/

# Check CloudFront invalidation status
aws cloudfront list-invalidations \
  --distribution-id E39O1P4S061DZS

# Force new invalidation
aws cloudfront create-invalidation \
  --distribution-id E39O1P4S061DZS \
  --paths "/*"
```

### Lambda Not Updating

```bash
# Update Lambda code directly
cd lambda
zip -r function.zip *.js node_modules
aws lambda update-function-code \
  --function-name CalisthenicsAppStack-CompetitionsLambda \
  --zip-file fileb://function.zip
```

## Monitoring

### CloudWatch Logs

```bash
# API Lambda logs
aws logs tail /aws/lambda/CalisthenicsAppStack-CompetitionsLambda --follow

# All Lambda functions
aws logs tail /aws/lambda/CalisthenicsAppStack --follow
```

### Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=CalisthenicsAppStack-CompetitionsLambda \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=CalisthenicsApi \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Cost Monitoring

```bash
# Current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## Cleanup

### Delete Everything

```bash
export AWS_PROFILE=labvel-dev

# Delete stack (includes all resources)
npm run destroy

# Confirm deletion
# Note: S3 buckets are auto-deleted due to RemovalPolicy.DESTROY
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy
        run: npm run deploy:all
```

## Best Practices

1. **Always test locally first** - Use `npm run local:api`
2. **Preview changes** - Run `cdk diff` before deploying
3. **Deploy during low traffic** - Minimize user impact
4. **Monitor after deployment** - Check logs and metrics
5. **Keep backups** - Export important data before major changes
6. **Use version tags** - Tag releases in git
7. **Document changes** - Update CHANGELOG.md

## Support

For issues:
1. Check CloudWatch Logs
2. Review CloudFormation events
3. Verify environment variables
4. Test API endpoints manually
5. Check this documentation
