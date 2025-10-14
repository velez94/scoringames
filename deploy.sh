#!/bin/bash

echo "🚀 Deploying Calisthenics Competition App..."

# Install CDK dependencies
echo "📦 Installing CDK dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Bootstrap CDK (only needed once per account/region)
#echo "🏗️ Bootstrapping CDK..."
#npx cdk bootstrap --profile labvel-dev 

# Deploy the stack
echo "☁️ Deploying to AWS..."
npx cdk deploy --require-approval never --profile labvel-dev

# Get outputs
echo "📋 Getting deployment outputs..."
OUTPUTS=$(npx cdk list --profile labvel-dev --json)

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update frontend/src/App.js with the actual Cognito and API Gateway URLs"
echo "2. Build and deploy the frontend to the S3 bucket"
echo "3. Configure user roles in Cognito User Pool"
echo ""
echo "🔗 Check AWS Console for:"
echo "- Cognito User Pool ID"
echo "- API Gateway URL" 
echo "- CloudFront Distribution URL"
