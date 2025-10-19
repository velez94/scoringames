# Deployment Procedures

## Backend Deployment (CDK)
```bash
cd /home/labvel/projects/scoringames
cdk deploy --profile labvel-dev --require-approval never
```

## Frontend Deployment
```bash
cd frontend
npm run build
aws s3 sync build/ s3://calisthenics-app-571340586587 --delete --profile labvel-dev
aws cloudfront create-invalidation --distribution-id E1MZ3OMBI2NDM3 --paths "/*" --profile labvel-dev
```

## Environment Variables
### Lambda Functions
- `EVENTS_TABLE`, `ORGANIZATIONS_TABLE`, `SCORES_TABLE` etc.
- `EVENT_IMAGES_BUCKET` for S3 uploads

### Frontend (aws-exports.js)
- `REACT_APP_API_URL` (without trailing slash)
- `REACT_APP_USER_POOL_ID`, `REACT_APP_USER_POOL_CLIENT_ID`
- `REACT_APP_REGION`

## Testing After Deployment
- Test public endpoints: `/public/events`
- Verify authenticated endpoints return 401 instead of 404
- Check CORS headers are present in all responses
