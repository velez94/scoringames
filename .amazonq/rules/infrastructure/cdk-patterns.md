# CDK Infrastructure Patterns

## Purpose
Ensures consistent and maintainable infrastructure deployment using AWS CDK best practices for the ScorinGames platform.

## Priority
**Critical** - Must be followed without exception

## Instructions
- Always use AWS CDK for infrastructure changes, never modify resources directly in AWS console
- Use microservices pattern with separate Lambda functions for each domain (competitions, events, scores, categories, wods, users)
- Deploy changes using: `cdk deploy --profile labvel-dev --require-approval never`
- All Lambda functions must include proper CORS headers with `Access-Control-Allow-Origin: '*'`
- Update Lambda descriptions to force redeployment when code changes
- Use 256MB memory and 30-second timeout for all services
- Include proper error handling with try-catch blocks

## Error Handling
- If CDK deployment fails, check for resource conflicts and retry
- If Lambda code changes don't deploy, update the function description to force redeployment
- For permission errors, verify IAM roles have necessary permissions
- If unsure about CDK syntax, refer to existing stack patterns in the project
