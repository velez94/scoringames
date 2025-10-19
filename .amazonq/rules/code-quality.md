# Code Quality Standards

## Purpose
Maintains high code quality and security standards while ensuring minimal, efficient implementations for the ScorinGames platform.

## Priority
**Medium** - Important guidelines that shape behavior

## Instructions
- Write only the ABSOLUTE MINIMAL amount of code needed to address requirements correctly
- Avoid verbose implementations and any code that doesn't directly contribute to the solution
- Use proper async/await patterns instead of callbacks
- Include proper error handling with try-catch blocks
- Deduplicate data when returning from APIs (e.g., categories by categoryId)
- Validate all input data in Lambda functions
- Use environment variables for all configuration
- Handle missing dependencies gracefully (don't import non-existent utils)

## Error Handling
- If dependencies are missing, implement fallback solutions or create minimal implementations
- For validation errors, return clear error messages with proper HTTP status codes
- If environment variables are missing, use sensible defaults where possible
- When in doubt about implementation approach, choose the simpler solution
