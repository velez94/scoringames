# Cost Optimization Patterns

## Purpose
Maintains cost-effective AWS resource usage while ensuring performance and reliability for the ScorinGames platform, preventing unexpected billing spikes.

## Priority
**High** - Should be followed unless conflicting with a critical rule

## Instructions
- When adding new AWS resources, ALWAYS consider cost implications
- Use DynamoDB on-demand billing mode instead of provisioned capacity
- Set reserved concurrent executions on Lambda functions to prevent runaway costs
- Use S3 lifecycle policies for event images older than 1 year
- Monitor and alert on daily AWS costs exceeding $50
- Use CloudWatch log retention periods (7 days for debug logs, 30 days for error logs)
- Implement auto-scaling policies for any compute resources
- After cost optimization changes, output "💰 Optimized costs for: [resource]"

## Error Handling
- If cost monitoring alerts don't exist, create basic CloudWatch billing alarms
- If unsure about resource sizing, start with smaller instances and scale up
- For cost spikes, immediately check Lambda concurrent executions and DynamoDB consumption
- If optimization conflicts with performance, document the trade-off decision
