# Frontend Stack

## Overview
CDK stack for ScorinGames React frontend hosting using S3 + CloudFront.

## Resources

- **S3 Bucket**: Static website hosting
  - Private bucket with CloudFront OAI
  - SPA routing (404 → index.html)
  - Retained on stack deletion

- **CloudFront Distribution**: CDN
  - HTTPS redirect
  - Optimized caching
  - Error page routing for SPA

## Deployment

### 1. Deploy Infrastructure
```bash
cd /home/labvel/projects/scoringames
cdk deploy ScorinGames/Frontend --profile labvel-dev
```

### 2. Deploy Frontend Code
```bash
# Automated script
./scripts/deploy-frontend.sh

# Manual
cd frontend
npm run build
aws s3 sync build/ s3://scoringames-frontend-dev --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*" --profile labvel-dev
```

## Outputs

- `BucketName`: S3 bucket name
- `DistributionId`: CloudFront distribution ID
- `DistributionDomain`: CloudFront URL
- `DeployCommand`: Full deployment command

## Configuration

### Environment Variables
Update `frontend/src/aws-config.js` with stack outputs:
```javascript
const config = {
  apiUrl: '<ApiUrl from ScorinGames stack>',
  userPoolId: '<UserPoolId from ScorinGames stack>',
  userPoolClientId: '<UserPoolClientId from ScorinGames stack>',
  region: 'us-east-2'
};
```

## Migration from Manual Setup

If you have existing S3 bucket and CloudFront:

1. **Import existing resources** (optional):
   ```bash
   cdk import ScorinGames/Frontend
   ```

2. **Or create new resources**:
   - Deploy new stack
   - Update DNS to point to new CloudFront
   - Delete old resources

## Cost

- **S3**: ~$0.023/GB storage + $0.09/GB transfer
- **CloudFront**: ~$0.085/GB transfer (first 10TB)
- **Estimated**: ~$5-10/month for typical usage

## Notes

- Bucket has `RETAIN` policy - won't be deleted with stack
- CloudFront invalidations: First 1000/month free
- SPA routing configured for React Router
