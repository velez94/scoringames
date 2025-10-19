# React Frontend Patterns

## AWS Amplify Integration
- Use `API.get/post/put/delete` for all API calls
- Configure endpoints in `aws-config.js`
- Handle authentication with `useAuthenticator` hook

## Component Organization
- **Public Components**: No auth required (PublicEvents, PublicEventDetail)
- **Athlete Components**: Authenticated athletes (AthleteProfile, AthleteLeaderboard)
- **Backoffice Components**: Organizers with organization-scoped access

## State Management
- Use OrganizationContext for backoffice users
- Persist selectedOrganization to localStorage
- Handle super admin "All Organizations" view

## Form Patterns
- Include proper validation for all input fields
- Use controlled components with useState
- Handle loading states and error messages
- Deduplicate options in dropdowns (categories, etc.)

## API URL Configuration
- Remove trailing slashes from REACT_APP_API_URL
- Use environment variables for all configuration
- Handle CORS errors gracefully
