# API Endpoint Patterns

## Public Endpoints (No Auth Required)
- `/public/events` - Returns all published events
- `/public/events/{eventId}` - Returns specific published event
- Used by: Athlete event browsing

## Authenticated Endpoints
- All other endpoints require Cognito JWT authorization
- Use query parameters for filtering: `/scores?eventId={id}`, `/wods?eventId={id}`
- Organization-scoped endpoints: `/competitions?organizationId={id}`

## HTTP Status Codes
- 200: Success
- 404: Not found
- 401: Unauthorized
- 500: Internal server error

## CORS Requirements
- Always include proper CORS headers in all responses
- Headers: `Access-Control-Allow-Origin: '*'`, `Access-Control-Allow-Headers: 'Content-Type,Authorization'`
- Handle OPTIONS preflight requests

## Error Response Format
- Use consistent error message format: `{ message: "Error description" }`
- Include proper error context in logs
