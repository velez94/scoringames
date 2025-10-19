# Deployment Guide

## ✅ Twelve-Factor Compliance Improvements

This project now follows Twelve-Factor App best practices for configuration and deployment.

### What Changed

1. **Environment Variables** - Configuration externalized from code
2. **Automated Deployment** - Single command deployment script
3. **Build-time Config Injection** - AWS resources discovered dynamically
4. **Proper Gitignore** - Generated config files excluded from version control

## 🚀 Quick Start

### One-Command Deployment

```bash
./scripts/deploy.sh [environment] [aws-profile] [region]
```

**Examples:**
```bash
# Deploy to production with default profile
./scripts/deploy.sh production labvel-dev

# Deploy to development
./scripts/deploy.sh development labvel-dev

# Deploy to staging with custom region
./scripts/deploy.sh staging my-profile us-west-2
```

### What the Script Does

1. ✅ Deploys CDK infrastructure
2. ✅ Retrieves stack outputs (API URL, User Pool, etc.)
3. ✅ Generates frontend configuration file
4. ✅ Builds React application
5. ✅ Syncs to S3
6. ✅ Invalidates CloudFront cache
7. ✅ Displays deployment URLs

## 📋 Prerequisites

- AWS CLI configured with credentials
- Node.js 18+ and npm
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Appropriate IAM permissions

## 🔧 Configuration

### Environment Variables

The frontend uses environment-specific configuration:

**`.env.development`** (local development):
```env
REACT_APP_REGION=us-east-2
REACT_APP_ENV=development
```

**`.env.production`** (production builds):
```env
REACT_APP_REGION=us-east-2
REACT_APP_ENV=production
```

### Build-Time Configuration

During deployment, the script creates `src/aws-config.json`:

```json
{
  "apiUrl": "https://xxx.execute-api.us-east-2.amazonaws.com/prod/",
  "userPoolId": "us-east-2_xxxxx",
  "userPoolClientId": "xxxxx",
  "region": "us-east-2"
}
```

This file is:
- ✅ Generated automatically during deployment
- ✅ Excluded from Git (in `.gitignore`)
- ✅ Environment-specific
- ✅ Never contains hardcoded values

## 🏗️ Manual Deployment (Advanced)

If you need to deploy manually:

### 1. Deploy Infrastructure

```bash
cd /home/labvel/projects/scoringames
AWS_PROFILE=labvel-dev cdk deploy --require-approval never
```

### 2. Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs' \
  --profile labvel-dev
```

### 3. Create Frontend Config

```bash
cd frontend
cat > src/aws-config.json << EOF
{
  "apiUrl": "YOUR_API_URL",
  "userPoolId": "YOUR_USER_POOL_ID",
  "userPoolClientId": "YOUR_CLIENT_ID",
  "region": "us-east-2"
}
EOF
```

### 4. Build Frontend

```bash
npm run build
```

### 5. Deploy to S3

```bash
aws s3 sync build/ s3://YOUR_BUCKET_NAME --delete --profile labvel-dev
```

### 6. Invalidate CloudFront

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*" \
  --profile labvel-dev
```

## 🔍 Verification

After deployment:

1. **Check CloudFormation Stack**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name CalisthenicsAppStack \
     --profile labvel-dev
   ```

2. **Verify S3 Sync**
   ```bash
   aws s3 ls s3://YOUR_BUCKET_NAME/ --profile labvel-dev
   ```

3. **Check CloudFront Invalidation**
   ```bash
   aws cloudfront get-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --id YOUR_INVALIDATION_ID \
     --profile labvel-dev
   ```

4. **Test Website**
   - Open `https://YOUR_CLOUDFRONT_URL`
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

## 🐛 Troubleshooting

### Issue: "Config file not found"

**Solution:** The deployment script creates the config file. If building locally:
```bash
# Copy from deployed stack
aws cloudformation describe-stacks \
  --stack-name CalisthenicsAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendConfig`].OutputValue' \
  --output text \
  --profile labvel-dev > frontend/src/aws-config.json
```

### Issue: "CloudFront still showing old version"

**Solution:** 
1. Wait 1-2 minutes for invalidation to complete
2. Hard refresh browser: `Ctrl+Shift+R`
3. Clear browser cache
4. Check invalidation status:
   ```bash
   aws cloudfront get-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --id YOUR_INVALIDATION_ID \
     --profile labvel-dev
   ```

### Issue: "CDK deployment fails"

**Solution:**
1. Check AWS credentials: `aws sts get-caller-identity --profile labvel-dev`
2. Verify CDK bootstrap: `cdk bootstrap aws://ACCOUNT/REGION`
3. Check IAM permissions
4. Review CloudFormation events in AWS Console

### Issue: "S3 sync permission denied"

**Solution:**
```bash
# Verify bucket exists
aws s3 ls --profile labvel-dev

# Check bucket policy
aws s3api get-bucket-policy \
  --bucket YOUR_BUCKET_NAME \
  --profile labvel-dev
```

## 📊 Deployment Metrics

Typical deployment times:
- CDK Infrastructure: 30-60 seconds (no changes) or 2-5 minutes (with changes)
- Frontend Build: 30-45 seconds
- S3 Sync: 10-20 seconds
- CloudFront Invalidation: 1-2 minutes

**Total: ~3-8 minutes**

## 🔐 Security Best Practices

✅ **Applied:**
- Configuration externalized from code
- Secrets never committed to Git
- Build-time config injection
- Environment-specific configurations
- IAM least privilege for deployment

❌ **Not Applied (Future):**
- Secrets Manager for sensitive values
- Parameter Store for configuration
- Encrypted environment variables
- Deployment approval workflows

## 🎯 Next Steps

1. **Set up CI/CD Pipeline** - Automate deployments on Git push
2. **Add Staging Environment** - Test before production
3. **Implement Blue-Green Deployments** - Zero-downtime releases
4. **Add Monitoring** - CloudWatch dashboards and alarms
5. **Set up Local Development** - LocalStack for offline development

## 📚 Related Documentation

- [Twelve-Factor Compliance Status](./TWELVE_FACTOR_CURRENT_STATUS.md)
- [Serverless Best Practices](./SERVERLESS_BEST_PRACTICES.md)
- [Architecture Documentation](./MICROSERVICES_ARCHITECTURE.md)
