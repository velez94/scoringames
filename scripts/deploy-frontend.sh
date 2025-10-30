#!/bin/bash
# Deploy frontend to S3 and invalidate CloudFront cache

set -e

PROFILE=${AWS_PROFILE:-labvel-dev}
REGION=${AWS_REGION:-us-east-2}

echo "🚀 Deploying ScorinGames Frontend..."

# Get stack outputs
echo "📋 Getting stack outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ScorinGames-Frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name ScorinGames-Frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

echo "📦 Bucket: $BUCKET_NAME"
echo "☁️  Distribution: $DISTRIBUTION_ID"

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm run build

# Sync to S3
echo "📤 Uploading to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --delete --profile $PROFILE

# Invalidate CloudFront
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --profile $PROFILE)

echo "✅ Deployment complete!"
echo "🆔 Invalidation ID: $INVALIDATION_ID"
echo "🌐 URL: https://$(aws cloudformation describe-stacks \
  --stack-name ScorinGames-Frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomain`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)"
