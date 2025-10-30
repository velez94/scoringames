# Frontend Stack - Implementation Complete ✅

## Overview
Created CDK stack for ScorinGames React frontend hosting using S3 + CloudFront.

## What Was Created

### 1. Frontend Stack (`infrastructure/frontend/frontend-stack.ts`)

**Resources:**
- **S3 Bucket**: `scoringames-frontend-{stage}`
  - Private bucket with CloudFront access
  - SPA routing (404/403 → index.html)
  - Retained on stack deletion
  
- **CloudFront Distribution**:
  - HTTPS redirect enforced
  - Optimized caching policy
  - Error page routing for React Router
  - Global CDN distribution

**Outputs:**
- `BucketName`: S3 bucket name
- `DistributionId`: CloudFront distribution ID
- `DistributionDomain`: CloudFront URL
- `DeployCommand`: Complete deployment command

### 2. Deployment Script (`scripts/deploy-frontend.sh`)

Automated deployment script that:
1. Gets stack outputs (bucket name, distribution ID)
2. Builds React frontend
3. Syncs to S3
4. Invalidates CloudFront cache
5. Shows deployment URL

### 3. Documentation

- `infrastructure/frontend/README.md` - Stack documentation
- `docs/FRONTEND_STACK.md` - This document

## Deployment

### First Time Setup

```bash
# 1. Deploy infrastructure
cd /home/labvel/projects/scoringames
cdk deploy ScorinGames/Frontend --profile labvel-dev

# 2. Note the outputs (bucket name, distribution ID, URL)

# 3. Update frontend config with API URL
# Edit frontend/src/aws-config.js with stack outputs
```

### Deploy Frontend Code

```bash
# Automated (recommended)
./scripts/deploy-frontend.sh

# Manual
cd frontend
npm run build
aws s3 sync build/ s3://scoringames-frontend-dev --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*" --profile labvel-dev
```

## Stack Structure

```
infrastructure/
├── frontend/
│   ├── frontend-stack.ts    # S3 + CloudFront stack
│   └── README.md            # Stack documentation
└── main-stack.ts            # Includes FrontendStack
```

## Integration with Main Stack

```typescript
// main-stack.ts
import { FrontendStack } from './frontend/frontend-stack';

// ...

const frontendStack = new FrontendStack(this, 'Frontend', {
  stage: props.stage,
});
```

## Benefits

### Before (Manual)
- ❌ Manual S3 bucket creation
- ❌ Manual CloudFront setup
- ❌ Hardcoded bucket names
- ❌ No infrastructure as code
- ❌ Difficult to replicate environments

### After (CDK)
- ✅ Infrastructure as code
- ✅ Automated deployment
- ✅ Environment-specific resources
- ✅ Easy to replicate (dev/staging/prod)
- ✅ Version controlled configuration

## Migration from Existing Setup

If you have existing S3 bucket (`calisthenics-app-571340586587`) and CloudFront (`E1MZ3OMBI2NDM3`):

### Option 1: Keep Existing (Recommended for Production)
Continue using manual deployment to existing resources:
```bash
cd frontend
npm run build
aws s3 sync build/ s3://calisthenics-app-571340586587 --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id E1MZ3OMBI2NDM3 --paths "/*" --profile labvel-dev
```

### Option 2: Import Existing Resources
```bash
cdk import ScorinGames/Frontend --profile labvel-dev
# Follow prompts to import existing S3 and CloudFront
```

### Option 3: Create New Resources
```bash
# Deploy new stack
cdk deploy ScorinGames/Frontend --profile labvel-dev

# Update DNS to point to new CloudFront
# Delete old resources when ready
```

## Environment Configuration

After deploying infrastructure, update frontend config:

```javascript
// frontend/src/aws-config.js
const config = {
  apiUrl: 'https://4vv0cl30sf.execute-api.us-east-2.amazonaws.com/prod',
  userPoolId: 'us-east-2_xxx',
  userPoolClientId: 'xxx',
  region: 'us-east-2'
};
```

Get values from stack outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name ScorinGames \
  --query 'Stacks[0].Outputs' \
  --profile labvel-dev
```

## Cost Estimate

- **S3 Storage**: ~$0.023/GB/month
- **S3 Transfer**: ~$0.09/GB
- **CloudFront**: ~$0.085/GB (first 10TB)
- **CloudFront Requests**: ~$0.0075 per 10,000 requests
- **Estimated Total**: ~$5-10/month for typical usage

## Features

### SPA Routing
- 404 errors redirect to index.html
- 403 errors redirect to index.html
- React Router works correctly
- Direct URL access supported

### Performance
- CloudFront CDN (global edge locations)
- Optimized caching policy
- HTTPS enforced
- Gzip compression

### Security
- Private S3 bucket (no public access)
- CloudFront Origin Access Identity
- HTTPS only
- No direct S3 access

## Monitoring

### CloudWatch Metrics
- CloudFront requests
- CloudFront data transfer
- CloudFront error rates
- S3 bucket size

### Logs
- CloudFront access logs (optional)
- S3 access logs (optional)

## Troubleshooting

### Issue: Old content showing after deployment
**Solution**: CloudFront cache not invalidated
```bash
aws cloudfront create-invalidation \
  --distribution-id <ID> \
  --paths "/*" \
  --profile labvel-dev
```

### Issue: 403 Forbidden errors
**Solution**: Check CloudFront OAI permissions on S3 bucket

### Issue: React Router 404s
**Solution**: Verify error response configuration in CloudFront

## Next Steps

1. **Deploy Infrastructure**: `cdk deploy ScorinGames/Frontend`
2. **Deploy Frontend**: `./scripts/deploy-frontend.sh`
3. **Configure DNS**: Point custom domain to CloudFront (optional)
4. **Set up CI/CD**: Automate frontend deployments (optional)

## Summary

✅ **Frontend Stack Complete**
- S3 bucket for static hosting
- CloudFront distribution for CDN
- Automated deployment script
- Infrastructure as code
- Environment-specific resources
- Production-ready configuration

The frontend infrastructure is now managed by CDK and can be deployed consistently across environments! 🚀
