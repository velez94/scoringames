# Monitoring - Observability Patterns

## Purpose
Ensures consistent monitoring coverage is maintained when adding new features to the ScorinGames platform, enabling proactive issue detection and performance optimization.

## Priority
**High** - Should be followed unless conflicting with a critical rule

## Instructions
- When implementing a major feature, ALWAYS check if monitoring needs are addressed
- Major features include: new Lambda functions, API endpoints, database tables, S3 integrations
- Use CloudWatch Logs for all Lambda functions with structured logging via `logger.info/error`
- Include request/response logging with sanitized data (no PII)
- Set up CloudWatch alarms for Lambda errors, duration, and throttles
- Monitor DynamoDB throttling and consumed capacity
- Track API Gateway 4xx/5xx error rates and latency
- After adding monitoring, output "📊 Added monitoring for: [feature]"

## Error Handling
- If CloudWatch log groups don't exist, they will be created automatically by Lambda
- If unsure whether a feature needs monitoring, err on the side of caution and add it
- For new microservices, copy monitoring patterns from existing services
- If monitoring setup fails, document the gap and create a follow-up task
