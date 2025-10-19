#!/bin/bash
set -e

echo "🚀 Setting up local multi-tenant environment..."

# Start DynamoDB Local
echo "📦 Starting DynamoDB Local..."
docker-compose up -d

# Wait for DynamoDB to be ready
echo "⏳ Waiting for DynamoDB..."
sleep 3

# Create tables
echo "🗄️  Creating DynamoDB tables..."

# Competitions table
aws dynamodb create-table \
  --table-name competitions \
  --attribute-definitions \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=startDate,AttributeType=S \
  --key-schema AttributeName=competitionId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=status-index,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=startDate,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Competitions table exists"

# Organizer-Competitions table
aws dynamodb create-table \
  --table-name organizer-competitions \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=competitionId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=competitionId,KeyType=RANGE \
  --global-secondary-indexes \
    "IndexName=competition-organizers-index,KeySchema=[{AttributeName=competitionId,KeyType=HASH},{AttributeName=userId,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Organizer-Competitions table exists"

# Athlete-Competitions table
aws dynamodb create-table \
  --table-name athlete-competitions \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=registeredAt,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=competitionId,KeyType=RANGE \
  --global-secondary-indexes \
    "IndexName=competition-athletes-index,KeySchema=[{AttributeName=competitionId,KeyType=HASH},{AttributeName=registeredAt,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Athlete-Competitions table exists"

# Athletes table
aws dynamodb create-table \
  --table-name athletes \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Athletes table exists"

# Events table
aws dynamodb create-table \
  --table-name events \
  --attribute-definitions \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=eventId,AttributeType=S \
  --key-schema \
    AttributeName=competitionId,KeyType=HASH \
    AttributeName=eventId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Events table exists"

# Categories table
aws dynamodb create-table \
  --table-name categories \
  --attribute-definitions \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=categoryId,AttributeType=S \
  --key-schema \
    AttributeName=competitionId,KeyType=HASH \
    AttributeName=categoryId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Categories table exists"

# WODs table
aws dynamodb create-table \
  --table-name wods \
  --attribute-definitions \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=wodId,AttributeType=S \
  --key-schema \
    AttributeName=competitionId,KeyType=HASH \
    AttributeName=wodId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ WODs table exists"

# Scores table
aws dynamodb create-table \
  --table-name scores \
  --attribute-definitions \
    AttributeName=competitionId,AttributeType=S \
    AttributeName=scoreId,AttributeType=S \
    AttributeName=eventId,AttributeType=S \
    AttributeName=score,AttributeType=N \
  --key-schema \
    AttributeName=competitionId,KeyType=HASH \
    AttributeName=scoreId,KeyType=RANGE \
  --global-secondary-indexes \
    "IndexName=event-scores-index,KeySchema=[{AttributeName=eventId,KeyType=HASH},{AttributeName=score,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 \
  --no-cli-pager 2>/dev/null || echo "✓ Scores table exists"

echo ""
echo "✅ Local multi-tenant environment ready!"
echo ""
echo "📊 DynamoDB Admin UI: http://localhost:8001"
echo "🗄️  DynamoDB Endpoint: http://localhost:8000"
echo ""
echo "Next steps:"
echo "  1. Run: npm run seed:local (to add sample competition data)"
echo "  2. Run: npm run dev:api (to start local API)"
echo "  3. Run: cd frontend && npm start"
