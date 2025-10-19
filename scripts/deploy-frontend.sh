#!/bin/bash
set -e

echo "🚀 Deploying Frontend to AWS..."

# Get stack outputs
echo "📋 Getting stack outputs..."
STACK_NAME="CalisthenicsAppStack"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

WEBSITE_BUCKET=$(aws s3 ls --profile ${AWS_PROFILE:-labvel-dev} | grep calisthenics-app | awk '{print $3}')

CLOUDFRONT_ID=$(aws cloudformation describe-stack-resources \
  --stack-name $STACK_NAME \
  --query "StackResources[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId" \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

echo "✓ API URL: $API_URL"
echo "✓ User Pool: $USER_POOL_ID"
echo "✓ S3 Bucket: $WEBSITE_BUCKET"
echo "✓ CloudFront: $CLOUDFRONT_ID"

# Update .env.production
echo ""
echo "📝 Updating .env.production..."
cat > frontend/.env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=us-east-2
REACT_APP_ENV=production
EOF

echo "✓ Environment variables updated"

# Build frontend
echo ""
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

echo "✓ Build complete"

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 sync frontend/build/ s3://$WEBSITE_BUCKET/ --delete --profile ${AWS_PROFILE:-labvel-dev}

echo "✓ Upload complete"

# Create CloudFront invalidation
echo ""
echo "🔄 Creating CloudFront invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

echo "✓ Invalidation created: $INVALIDATION_ID"

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE:-labvel-dev})

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "👤 Ensuring super admin exists..."
node scripts/create-super-admin.js \
  --email=admin@scoringames.com \
  --password=Admin123! \
  --region=us-east-2 \
  --profile=${AWS_PROFILE:-labvel-dev} || echo "⚠️  Super admin already configured"

echo ""
echo "🌐 Website URL: https://$CLOUDFRONT_URL"
echo "⏳ CloudFront invalidation in progress (takes 1-2 minutes)"
echo ""
echo "Next steps:"
echo "  1. Wait for invalidation to complete"
echo "  2. Visit: https://$CLOUDFRONT_URL"
echo "  3. Login with: admin@scoringames.com / Admin123!"
