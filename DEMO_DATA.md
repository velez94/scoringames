# Demo Data

## ✅ Complete Demo Environment

### Demo Accounts

**Super Admin:**
- **Admin** - admin@scoringames.com / (your password)
  - Can see ALL events across all organizers
  - Full system access
  - Bypasses multi-tenant filters

**Organizers:**
- **Sarah Johnson** - organizer1@demo.com / Demo123!
  - Manages: Summer Games 2025
- **Mike Chen** - organizer2@demo.com / Demo123!
  - Manages: Winter Challenge 2025

**Athletes:**
- **Alex Martinez** (AlexM) - athlete1@demo.com / Demo123!
  - Category: RX Male
  - Registered: Summer Games 2025
  - Scores: Grace (180s), Murph (2400s), Fran (240s)

- **Emma Davis** (EmmaD) - athlete2@demo.com / Demo123!
  - Category: RX Female
  - Registered: Summer Games 2025
  - Scores: Grace (240s), Murph (2700s)

- **Jordan Smith** (JordanS) - athlete3@demo.com / Demo123!
  - Category: Scaled Male
  - Registered: Summer Games 2025
  - Scores: Grace (300s)

- **Taylor Brown** (TaylorB) - athlete4@demo.com / Demo123!
  - Category: Scaled Female
  - Registered: Summer Games 2025

### Events

**Summer Games 2025** (Organizer 1)
- Location: Miami, FL
- Dates: June 1-3, 2025
- Status: Upcoming
- Published: Yes
- Categories: RX Male, RX Female, Scaled Male, Scaled Female
- WODs: Grace, Murph, Fran
- Registered Athletes: 4
- Scores: 6

**Winter Challenge 2025** (Organizer 2)
- Location: Denver, CO
- Dates: December 15-17, 2025
- Status: Upcoming
- Published: Yes

### WODs (Summer Games 2025)

1. **Grace**
   - Description: 30 Clean and Jerks for time
   - Format: Time
   - Time Cap: 10 minutes

2. **Murph**
   - Description: 1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run
   - Format: Time
   - Time Cap: 60 minutes

3. **Fran**
   - Description: 21-15-9 Thrusters and Pull-ups
   - Format: Time
   - Time Cap: 10 minutes

## Testing Multi-Tenant Isolation

### Test 1: Organizer Isolation ✅

1. Login as **organizer1@demo.com**
   - Navigate to Events
   - Should see: "Summer Games 2025" ONLY
   - Should NOT see: "Winter Challenge 2025"

2. Login as **organizer2@demo.com**
   - Navigate to Events
   - Should see: "Winter Challenge 2025" ONLY
   - Should NOT see: "Summer Games 2025"

### Test 2: Athlete View ✅

1. Login as **athlete1@demo.com**
   - Navigate to Profile
   - Should see: Registered for "Summer Games 2025"
   - Should see: 3 scores (Grace, Murph, Fran)
   - Navigate to Leaderboard
   - Should see: Rankings for Summer Games 2025

### Test 3: Public View ✅

1. Visit `/events` (not logged in)
   - Should see: Both events (published)
   - Click on "Summer Games 2025"
   - Should see: Event details
   - Should NOT see: WODs or scores (requires login)

## Data Structure

```
Organizer 1 (Sarah)
  └─ Summer Games 2025
      ├─ Categories (4)
      │   ├─ RX Male
      │   ├─ RX Female
      │   ├─ Scaled Male
      │   └─ Scaled Female
      ├─ WODs (3)
      │   ├─ Grace
      │   ├─ Murph
      │   └─ Fran
      ├─ Athletes (4)
      │   ├─ Alex Martinez (RX Male)
      │   ├─ Emma Davis (RX Female)
      │   ├─ Jordan Smith (Scaled Male)
      │   └─ Taylor Brown (Scaled Female)
      └─ Scores (6)
          ├─ Alex: Grace, Murph, Fran
          ├─ Emma: Grace, Murph
          └─ Jordan: Grace

Organizer 2 (Mike)
  └─ Winter Challenge 2025
      └─ (Empty - ready for setup)
```

## Resetting Demo Data

To reset and recreate demo data:

```bash
# 1. Delete existing demo users (optional)
# 2. Run seed script
cd /home/labvel/projects/scoringames
AWS_PROFILE=labvel-dev node scripts/seed-demo-data.js
```

## Features Demonstrated

✅ **Multi-Tenant Isolation**
- Each organizer sees only their events
- Data properly segregated

✅ **Event Management**
- Create events with details
- Publish/unpublish events
- Multiple categories per event

✅ **WOD Management**
- Multiple WODs per event
- Different formats (time, reps, AMRAP)
- Time caps

✅ **Athlete Registration**
- Athletes register for events
- Category selection
- Registration tracking

✅ **Score Submission**
- Athletes submit scores
- Scores linked to WODs and categories
- Leaderboard calculation

✅ **Leaderboards**
- WOD-specific leaderboards
- General leaderboards with points
- Category filtering
- Real-time rankings

✅ **Public Pages**
- Published events visible to public
- Event details page
- Sign-in CTA for registration

## Security Features

✅ **Authentication**
- Cognito user pools
- JWT tokens
- Role-based access (organizer/athlete)

✅ **Authorization**
- Organizers can only access their events
- Athletes can only see published events
- Public endpoints properly filtered

✅ **Data Isolation**
- ORGANIZER_EVENTS_TABLE junction table
- Query by userId for event access
- No cross-tenant data leakage

## Next Steps

1. **Login as Organizer 1** - Explore event management
2. **Login as Organizer 2** - Create your own event
3. **Login as Athlete** - View profile and leaderboards
4. **Test Multi-Tenant** - Verify isolation between organizers
5. **Public View** - Check `/events` page without login

---

**Status:** ✅ Ready for Demo
**Last Updated:** 2025-10-17
**Total Users:** 6 (2 organizers, 4 athletes)
**Total Events:** 2
**Total Scores:** 6
