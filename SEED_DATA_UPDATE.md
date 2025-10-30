# Seed Data & Super Admin Update

## Changes Made

### 1. Updated Categories (8 total)

#### Men's Categories
- **Men's Intermediate** - Basic calisthenics skills
- **Men's Advanced** - Strong calisthenics foundation
- **Men's Professional** - Competitive experience required
- **Men's Elite** - Top tier performance

#### Women's Categories
- **Women's Intermediate** - Basic calisthenics skills
- **Women's Advanced** - Strong calisthenics foundation
- **Women's Professional** - Competitive experience required
- **Women's Elite** - Top tier performance

### 2. Super Admin Email Updated

**Old:** `admin@scoringames.com`  
**New:** `admin@athleon.fitness`

#### Files Updated:
- All Lambda functions (`lambda/**/*.js`)
- Frontend components (`frontend/src/**/*.js`)
- Seed scripts (`scripts/*.js`)

## Deployment Status

✅ **Backend Deployed** - All Lambda functions updated with new super admin email  
✅ **Frontend Deployed** - UI updated with new super admin email  
✅ **Seed Data Ready** - Run `npm run seed` to populate new categories

## Running Seed Data

To populate the database with new categories:

```bash
cd /home/labvel/projects/scoringames
AWS_PROFILE=labvel-dev node scripts/seed-data.js
```

## Super Admin Access

The super admin account must now use:
- **Email:** `admin@athleon.fitness`
- **Cognito User Pool:** us-east-2_KUxqDApCY

**Note:** You'll need to create this user in Cognito or update the existing admin user's email.

## Category Structure

All categories are:
- Age range: 18+
- Gender-specific (Male/Female)
- Skill-level based (Intermediate → Advanced → Professional → Elite)

## Next Steps

1. Create/update Cognito user with email `admin@athleon.fitness`
2. Run seed script to populate categories
3. Test super admin access with new email
4. Update any documentation referencing old admin email
