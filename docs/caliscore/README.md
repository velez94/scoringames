# CaliScore Business Rules Documentation

This directory contains comprehensive business rules and logic documentation for the ScorinGames calisthenics competition management platform.

## Documentation Structure

### [RBAC Rules](./rbac-rules.md)
Role-Based Access Control implementation and permission matrix
- User roles hierarchy (Super Admin, Organization roles, Athletes)
- Permission matrix for all resources
- Authorization flow and implementation status
- Security considerations and required implementations

### [Event Management Rules](./event-management-rules.md)
Complete event lifecycle and management rules
- Event state transitions (Draft → Published → Active → Completed)
- Publishing rules and validation requirements
- Registration management and organizer powers
- Category and WOD assignment rules
- Score submission and deletion protection

### [WOD Management Rules](./wod-management-rules.md)
Workout of the Day (WOD) management and security rules
- Current authorization gaps and required RBAC implementation
- Data integrity issues with orphaned references
- Required business rules for safe deletion
- Implementation priorities for security and data integrity

### [Data Integrity Rules](./data-integrity-rules.md)
Database consistency and referential integrity rules
- Cascade deletion rules for all entities
- Referential integrity relationships and orphaned data risks
- Data consistency rules and field standardization
- Validation rules and recovery procedures
- Monitoring requirements and audit procedures

## Key Business Rules Summary

### Security (Critical)
- **WODs Service**: Missing RBAC authorization - anyone can delete template WODs
- **Categories Service**: No organization validation implemented
- **Scores Service**: Basic auth only, no role-based validation

### Data Integrity (High Priority)
- **WOD Deletion**: No cascade cleanup, creates orphaned scores
- **Field Inconsistency**: AthleteEvents table uses both `registrationDate` and `registeredAt`
- **GSI Failures**: Query failures due to field name mismatches

### Event Management (Implemented)
- **Published Event Protection**: Cannot delete events with published status
- **Registration Cleanup**: Proper cascade deletion for athlete registrations
- **Organization Validation**: Full RBAC implementation for event operations

## Implementation Status

### ✅ Fully Implemented
- Event management with proper RBAC and deletion protection
- Organization-based access control for competitions
- Public event access for athletes

### 🔄 Partially Implemented  
- User authentication with JWT tokens (caching issues)
- Legacy event support for super admin access
- Basic score submission validation

### ❌ Not Implemented
- WOD service authorization and cascade deletion
- Category service organization validation
- Comprehensive audit logging and monitoring
- Data consistency validation and repair tools

## Critical Action Items

1. **Implement WOD RBAC**: Add organization-based authorization to prevent unauthorized deletions
2. **Add Cascade Deletion**: Implement safe deletion with proper cleanup of related data
3. **Fix Field Consistency**: Standardize field names across tables and GSI indexes
4. **Add Validation Rules**: Implement pre-operation validation for all critical operations
5. **Implement Monitoring**: Add real-time monitoring for data integrity violations

## Usage Guidelines

- Review relevant business rules before implementing new features
- Validate all changes against security and data integrity requirements
- Update documentation when business rules change
- Use this documentation for onboarding new developers
- Reference during code reviews to ensure compliance
