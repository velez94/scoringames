#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROFILE=${2:-labvel-dev}
REGION=${3:-us-east-2}
STACK_NAME="CalisthenicsAppStack"

echo -e "${BLUE}🚀 Deploying Calisthenics App to ${ENVIRONMENT}${NC}"
echo "Profile: $PROFILE"
echo "Region: $REGION"
echo ""

# Step 1: Deploy CDK Stack
echo -e "${YELLOW}📦 Step 1: Deploying CDK infrastructure...${NC}"
cd "$(dirname "$0")/.."
AWS_PROFILE=$PROFILE cdk deploy --require-approval never

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ CDK deployment failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ CDK deployment complete${NC}"
echo ""

# Step 2: Get Stack Outputs
echo -e "${YELLOW}🔍 Step 2: Retrieving stack outputs...${NC}"

get_output() {
  aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text \
    --profile $PROFILE \
    --region $REGION
}

API_URL=$(get_output "ApiUrl")
USER_POOL_ID=$(get_output "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
FRONTEND_BUCKET=$(get_output "FrontendBucketName")
DISTRIBUTION_ID=$(get_output "DistributionId")

echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "Frontend Bucket: $FRONTEND_BUCKET"
echo "Distribution ID: $DISTRIBUTION_ID"
echo ""

# Step 3: Create Frontend Config
echo -e "${YELLOW}⚙️  Step 3: Creating frontend configuration...${NC}"
cd frontend

cat > src/aws-config.json << EOF
{
  "apiUrl": "$API_URL",
  "userPoolId": "$USER_POOL_ID",
  "userPoolClientId": "$USER_POOL_CLIENT_ID",
  "region": "$REGION"
}
EOF

echo -e "${GREEN}✓ Configuration created${NC}"
echo ""

# Step 4: Build Frontend
echo -e "${YELLOW}🔨 Step 4: Building frontend...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Frontend build failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend build complete${NC}"
echo ""

# Step 5: Deploy to S3
echo -e "${YELLOW}☁️  Step 5: Deploying to S3...${NC}"
aws s3 sync build/ s3://$FRONTEND_BUCKET \
  --delete \
  --profile $PROFILE \
  --region $REGION

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ S3 sync failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ S3 deployment complete${NC}"
echo ""

# Step 6: Invalidate CloudFront
echo -e "${YELLOW}🔄 Step 6: Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --profile $PROFILE \
  --region us-east-1 \
  --query 'Invalidation.Id' \
  --output text)

echo "Invalidation ID: $INVALIDATION_ID"
echo -e "${GREEN}✓ CloudFront invalidation created${NC}"
echo ""

# Step 7: Get Website URL
WEBSITE_URL=$(get_output "WebsiteUrl")

echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌐 Website URL: https://$WEBSITE_URL${NC}"
echo -e "${GREEN}🔗 API URL: $API_URL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Note: CloudFront invalidation may take 1-2 minutes to complete."
echo "Use Ctrl+Shift+R to hard refresh your browser."
