#!/usr/bin/env node

// Example: Dynamic Progressive Tournament Configuration

console.log('🏆 Progressive Tournament Examples\n');

// Example 1: 12 Athletes Tournament (with wildcards)
const tournament12 = {
  competitionMode: 'VERSUS',
  eliminationRules: [
    {
      stage: 1,
      from: 12,
      to: 8,
      wildcards: 2, // 6 winners + 2 wildcards
      stageName: 'Quarterfinals'
    },
    {
      stage: 2,
      from: 8,
      to: 4,
      wildcards: 0, // 4 direct winners
      stageName: 'Semifinals'
    },
    {
      stage: 3,
      from: 4,
      to: 2,
      wildcards: 0, // 2 direct winners
      stageName: 'Finals'
    },
    {
      stage: 4,
      from: 2,
      to: 1,
      wildcards: 0, // 1 champion
      stageName: 'Championship'
    }
  ]
};

console.log('📊 12-Athlete Tournament:');
console.log('   Stage 1: 12 → 8 (6 winners + 2 wildcards)');
console.log('   Stage 2: 8 → 4 (4 direct winners)');
console.log('   Stage 3: 4 → 2 (2 direct winners)');
console.log('   Stage 4: 2 → 1 (1 champion)');

// Example 2: 16 Athletes Tournament (standard bracket)
const tournament16 = {
  competitionMode: 'VERSUS',
  eliminationRules: [
    {
      stage: 1,
      from: 16,
      to: 8,
      wildcards: 0,
      stageName: 'Round of 16'
    },
    {
      stage: 2,
      from: 8,
      to: 4,
      wildcards: 0,
      stageName: 'Quarterfinals'
    },
    {
      stage: 3,
      from: 4,
      to: 2,
      wildcards: 0,
      stageName: 'Semifinals'
    },
    {
      stage: 4,
      from: 2,
      to: 1,
      wildcards: 0,
      stageName: 'Finals'
    }
  ]
};

console.log('\n📊 16-Athlete Tournament:');
console.log('   Stage 1: 16 → 8 (8 direct winners)');
console.log('   Stage 2: 8 → 4 (4 direct winners)');
console.log('   Stage 3: 4 → 2 (2 direct winners)');
console.log('   Stage 4: 2 → 1 (1 champion)');

// Example 3: Custom 20 Athletes Tournament
const tournament20 = {
  competitionMode: 'VERSUS',
  eliminationRules: [
    {
      stage: 1,
      from: 20,
      to: 12,
      wildcards: 2, // 10 winners + 2 wildcards
      stageName: 'First Round'
    },
    {
      stage: 2,
      from: 12,
      to: 8,
      wildcards: 2, // 6 winners + 2 wildcards
      stageName: 'Quarterfinals'
    },
    {
      stage: 3,
      from: 8,
      to: 4,
      wildcards: 0,
      stageName: 'Semifinals'
    },
    {
      stage: 4,
      from: 4,
      to: 1,
      wildcards: 0,
      stageName: 'Finals'
    }
  ]
};

console.log('\n📊 20-Athlete Tournament:');
console.log('   Stage 1: 20 → 12 (10 winners + 2 wildcards)');
console.log('   Stage 2: 12 → 8 (6 winners + 2 wildcards)');
console.log('   Stage 3: 8 → 4 (4 direct winners)');
console.log('   Stage 4: 4 → 1 (1 champion)');

console.log('\n🔄 Tournament Flow:');
console.log('   1. Generate initial schedule with VERSUS mode');
console.log('   2. Athletes compete in matches');
console.log('   3. Scores are submitted to Score domain');
console.log('   4. Process results: POST /scheduler/{eventId}/{scheduleId}/process-results');
console.log('   5. Generate next stage: POST /scheduler/{eventId}/{scheduleId}/next-stage');
console.log('   6. Repeat until champion is determined');

console.log('\n📡 API Endpoints:');
console.log('   POST /scheduler/{eventId}/{scheduleId}/process-results');
console.log('   POST /scheduler/{eventId}/{scheduleId}/next-stage');
console.log('   GET  /scheduler/{eventId}/{scheduleId}/bracket');

console.log('\n✅ Features:');
console.log('   • Dynamic tournament generation for any number of athletes');
console.log('   • Wildcard selection based on scores from Score domain');
console.log('   • Flexible elimination rules defined by organizers');
console.log('   • Real-time bracket updates after each stage');
console.log('   • Integration with existing Score domain for results');
