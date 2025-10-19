# CloudWatch Insights Queries

## Prerequisites

Structured logging must be enabled in Lambda functions (using `utils/logger.js`).

## Common Queries

### 1. Error Rate by Service

```
fields @timestamp, service, message, error
| filter level = "ERROR"
| stats count() as errorCount by service
| sort errorCount desc
```

### 2. Slow Requests (>1 second)

```
fields @timestamp, service, message, @duration
| filter @duration > 1000
| sort @duration desc
| limit 20
```

### 3. Requests by Endpoint

```
fields @timestamp, path, method, level
| filter level = "INFO" and message = "Request received"
| stats count() as requestCount by path, method
| sort requestCount desc
```

### 4. Error Details

```
fields @timestamp, service, message, error, stack
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

### 5. Request Volume Over Time

```
fields @timestamp, service
| filter level = "INFO" and message = "Request received"
| stats count() as requests by bin(5m)
```

### 6. Failed Authentications

```
fields @timestamp, path, message
| filter message like /authentication failed/i or message like /unauthorized/i
| sort @timestamp desc
```

### 7. DynamoDB Operations

```
fields @timestamp, service, message, meta
| filter message like /DynamoDB/
| stats count() by service, message
```

### 8. Average Response Time by Service

```
fields @timestamp, service, @duration
| stats avg(@duration) as avgDuration, max(@duration) as maxDuration by service
| sort avgDuration desc
```

### 9. Recent Errors with Context

```
fields @timestamp, service, message, error, path, method, requestId
| filter level = "ERROR"
| sort @timestamp desc
| limit 20
```

### 10. User Activity

```
fields @timestamp, path, method, userId
| filter userId != ""
| stats count() as actions by userId
| sort actions desc
```

## How to Use

1. **Open CloudWatch Console**
   - Navigate to CloudWatch → Logs → Insights

2. **Select Log Groups**
   - `/aws/lambda/CalisthenicsAppStack-UsersLambda*`
   - `/aws/lambda/CalisthenicsAppStack-ScoresLambda*`
   - `/aws/lambda/CalisthenicsAppStack-CompetitionsLambda*`

3. **Paste Query**
   - Copy one of the queries above
   - Adjust time range (last 1 hour, 24 hours, etc.)

4. **Run Query**
   - Click "Run query"
   - Export results if needed

## Custom Metrics

### Create Metric Filter

```bash
# Error rate metric
aws logs put-metric-filter \
  --log-group-name /aws/lambda/CalisthenicsAppStack-UsersLambda \
  --filter-name ErrorRate \
  --filter-pattern '{ $.level = "ERROR" }' \
  --metric-transformations \
    metricName=ErrorCount,\
    metricNamespace=CalisthenicsApp,\
    metricValue=1
```

### Create Alarm

```bash
# Alert on high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name HighErrorRate \
  --alarm-description "Alert when error rate exceeds threshold" \
  --metric-name ErrorCount \
  --namespace CalisthenicsApp \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

## Best Practices

1. **Use Structured Logging**
   - Always use the Logger class
   - Include relevant context (userId, path, method)
   - Add correlation IDs for tracing

2. **Log Levels**
   - ERROR: Failures that need immediate attention
   - WARN: Potential issues or degraded performance
   - INFO: Normal operations (requests, responses)
   - DEBUG: Detailed debugging information

3. **Performance**
   - Avoid logging sensitive data (passwords, tokens)
   - Use sampling for high-volume logs
   - Set appropriate retention periods

4. **Monitoring**
   - Create dashboards for key metrics
   - Set up alarms for critical errors
   - Review logs regularly

## Example Log Output

```json
{
  "timestamp": "2025-10-16T23:40:00.000Z",
  "level": "INFO",
  "service": "UsersService",
  "message": "Request received",
  "requestId": "abc-123-def",
  "path": "/athletes/123/competitions",
  "method": "POST"
}
```

```json
{
  "timestamp": "2025-10-16T23:40:01.000Z",
  "level": "ERROR",
  "service": "UsersService",
  "message": "Request failed",
  "requestId": "abc-123-def",
  "path": "/athletes/123/competitions",
  "method": "POST",
  "error": "AccessDeniedException",
  "stack": "Error: AccessDeniedException\n    at ..."
}
```
