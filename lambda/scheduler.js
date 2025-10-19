const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('./utils/logger');

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;
const HEATS_TABLE = process.env.HEATS_TABLE;
const CLASSIFICATION_FILTERS_TABLE = process.env.CLASSIFICATION_FILTERS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;

// Competition scheduler with CRUD operations and detailed time management
class CompetitionScheduler {
  constructor(dynamodb) {
    this.dynamodb = dynamodb;
  }

  // Generate detailed schedule with precise timing
  async generateSchedule(eventId, config) {
    logger.info('=== SCHEDULER START ===', { eventId, configKeys: Object.keys(config || {}) });
    
    logger.info('Starting schedule generation', {
      eventId,
      competitionMode: config.competitionMode,
      numberOfHeats: config.numberOfHeats,
      athletesEliminatedPerFilter: config.athletesEliminatedPerFilter,
      heatWodMapping: config.heatWodMapping,
      wodsCount: config.wods?.length,
      athletesCount: config.athletes?.length,
      categoriesCount: config.categories?.length
    });
    
    const {
      wods, categories, athletes, days,
      maxDayHours = 10, lunchBreakHours = 1,
      competitionMode = 'HEATS', // HEATS, VERSUS, SIMULTANEOUS
      athletesPerHeat = 8,
      numberOfHeats, // Required for VERSUS mode
      athletesEliminatedPerFilter = 1, // How many athletes are eliminated per filter
      heatWodMapping = {}, // Maps heat numbers to WOD IDs for VERSUS mode
      startTime = '08:00',
      timezone = 'UTC',
      transitionTime = 5, // minutes between heats
      setupTime = 10 // minutes between WODs
    } = config;

    logger.info('Schedule generation input validation', {
      eventId,
      daysCount: days?.length || 0,
      wodsCount: wods?.length || 0,
      categoriesCount: categories?.length || 0,
      athletesCount: athletes?.length || 0,
      days: days?.map(d => ({ dayId: d.dayId, name: d.name })),
      wods: wods?.map(w => ({ wodId: w.wodId, name: w.name, dayId: w.dayId })),
      categories: categories?.map(c => ({ categoryId: c.categoryId, name: c.name })),
      athletes: athletes?.map(a => ({ userId: a.userId, firstName: a.firstName, categoryId: a.categoryId }))
    });

    // Validate required data
    if (!days || days.length === 0) {
      // Try to auto-generate days from event date range
      logger.info('No event days found, attempting to auto-generate from event dates');
      
      try {
        const EVENTS_TABLE = process.env.EVENTS_TABLE;
        const { Item: eventData } = await this.dynamodb.send(new GetCommand({
          TableName: EVENTS_TABLE,
          Key: { eventId }
        }));
        
        if (eventData && eventData.startDate && eventData.endDate) {
          const startDate = new Date(eventData.startDate);
          const endDate = new Date(eventData.endDate);
          const generatedDays = [];
          
          // Generate days between start and end date
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayId = `day-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayName = `Day ${generatedDays.length + 1}`;
            
            generatedDays.push({
              dayId,
              name: dayName,
              date: d.toISOString().split('T')[0],
              eventId
            });
          }
          
          logger.info('Auto-generated event days', { 
            eventId, 
            startDate: eventData.startDate, 
            endDate: eventData.endDate,
            generatedDaysCount: generatedDays.length,
            days: generatedDays.map(d => ({ dayId: d.dayId, name: d.name, date: d.date }))
          });
          
          // Use generated days for this schedule generation
          days = generatedDays;
        } else {
          throw new Error('No event days found and unable to auto-generate (missing event start/end dates). Please create event days first.');
        }
      } catch (error) {
        logger.error('Failed to auto-generate event days', { error: error.message });
        throw new Error('No event days found. Please create event days first or ensure the event has valid start/end dates.');
      }
    }
    if (!wods || wods.length === 0) {
      throw new Error('No WODs found. Please add WODs to the event first.');
    }
    if (!categories || categories.length === 0) {
      throw new Error('No categories found. Please add categories to the event first.');
    }
    if (!athletes || athletes.length === 0) {
      throw new Error('No registered athletes found. Please ensure athletes are registered for this event.');
    }

    // Validate VERSUS mode requirements
    if (competitionMode === 'VERSUS') {
      if (!numberOfHeats) {
        throw new Error('numberOfHeats is required for VERSUS competition mode');
      }
      if (!heatWodMapping || Object.keys(heatWodMapping).length === 0) {
        throw new Error('heatWodMapping is required for VERSUS competition mode');
      }
    }

    const schedule = {
      eventId,
      scheduleId: `schedule-${Date.now()}`,
      config: { maxDayHours, lunchBreakHours, competitionMode, athletesPerHeat, numberOfHeats, athletesEliminatedPerFilter, heatWodMapping, startTime, timezone, transitionTime, setupTime },
      days: [],
      totalDuration: 0,
      generatedAt: new Date().toISOString()
    };

    for (const day of days) {
      const daySchedule = await this.generateDaySchedule({
        dayId: day.dayId,
        wods: wods.filter(w => !w.dayId || w.dayId === day.dayId),
        categories, athletes, maxHours: maxDayHours, lunchBreak: lunchBreakHours,
        competitionMode, athletesPerHeat, numberOfHeats, athletesEliminatedPerFilter, heatWodMapping, startTime, timezone, transitionTime, setupTime
      });
      schedule.days.push(daySchedule);
    }

    // Save schedule to database (commented out for now)
    // await this.dynamodb.send(new PutCommand({
    //   TableName: SCHEDULES_TABLE,
    //   Item: schedule
    // }));

    return schedule;
  }

  // Generate detailed day schedule with precise timing
  async generateDaySchedule(config) {
    logger.info('Starting day schedule generation', {
      dayId: config.dayId,
      competitionMode: config.competitionMode,
      numberOfHeats: config.numberOfHeats,
      athletesEliminatedPerFilter: config.athletesEliminatedPerFilter,
      heatWodMapping: config.heatWodMapping
    });
    
    const { dayId, wods, categories, athletes, competitionMode, athletesPerHeat, numberOfHeats, athletesEliminatedPerFilter, heatWodMapping, startTime, timezone, transitionTime, setupTime } = config;
    
    const sessions = [];
    let currentTime = this.timeToMinutes(startTime);
    
    if (competitionMode === 'VERSUS') {
      logger.info('Processing VERSUS mode', { categoriesCount: categories.length });
      
      // Create sessions based on heat-to-WOD mapping
      for (const category of categories) {
        const categoryAthletes = athletes.filter(a => a.categoryId === category.categoryId);
        
        logger.info('Processing category', {
          categoryId: category.categoryId,
          categoryName: category.name,
          athletesInCategory: categoryAthletes.map(a => ({ name: `${a.firstName} ${a.lastName}`, id: a.userId }))
        });
        
        if (categoryAthletes.length === 0) {
          logger.warn('No athletes in category, skipping', { categoryId: category.categoryId });
          continue;
        }
        
        for (let heatNumber = 1; heatNumber <= numberOfHeats; heatNumber++) {
          const wodId = heatWodMapping[heatNumber];
          const wod = wods.find(w => w.wodId === wodId);
          
          logger.info('Processing heat', {
            heatNumber,
            wodId,
            wodFound: !!wod,
            wodName: wod?.name
          });
          
          if (!wod) {
            logger.warn('No WOD found for heat, skipping', { heatNumber, wodId });
            continue;
          }
          
          // Calculate how many athletes should be available for this heat
          const athletesEliminated = (heatNumber - 1) * athletesEliminatedPerFilter;
          const remainingAthletes = Math.max(0, categoryAthletes.length - athletesEliminated);
          
          logger.info('Athlete calculation', {
            heatNumber,
            athletesEliminatedPerFilter,
            athletesEliminated,
            totalAthletes: categoryAthletes.length,
            remainingAthletes,
            categoryAthletesDebug: categoryAthletes.map(a => ({ name: `${a.firstName} ${a.lastName}`, id: a.userId, categoryId: a.categoryId }))
          });
          
          if (remainingAthletes === 0) {
            logger.warn('No remaining athletes, skipping heat', { heatNumber });
            continue;
          }
          
          // For 0 eliminations, use all athletes in each heat
          // For eliminations > 0, use remaining athletes after eliminations
          let athletesForHeat;
          if (athletesEliminatedPerFilter === 0) {
            // No eliminations - same athletes compete in all heats
            athletesForHeat = categoryAthletes.slice(0, Math.min(2, categoryAthletes.length));
            logger.info('No eliminations - using same athletes for all heats', { heatNumber });
          } else {
            // With eliminations - use remaining athletes
            const startIndex = athletesEliminated;
            athletesForHeat = categoryAthletes.slice(startIndex, startIndex + Math.min(2, remainingAthletes));
            logger.info('With eliminations - using remaining athletes', { heatNumber, startIndex });
          }
          
          logger.info('Athletes selected for heat', {
            heatNumber,
            athletes: athletesForHeat.map(a => ({ name: `${a.firstName} ${a.lastName}`, id: a.userId }))
          });
          
          if (athletesForHeat.length === 0) {
            logger.warn('No athletes for heat, skipping', { heatNumber });
            continue;
          }
          
          const match = this.createSingleVersusMatch(athletesForHeat, heatNumber);
          
          const session = {
            sessionId: `${dayId}-heat-${heatNumber}-${category.categoryId}`,
            wodId: wod.wodId,
            wodName: wod.name,
            categoryId: category.categoryId,
            categoryName: category.name,
            competitionMode: 'VERSUS',
            heatNumber,
            numberOfHeats,
            startTime: this.minutesToTime(currentTime),
            startTimeUTC: this.convertToUTC(this.minutesToTime(currentTime), timezone),
            endTime: this.minutesToTime(currentTime + (wod.estimatedDuration || 15)),
            duration: wod.estimatedDuration || 15,
            matches: [match],
            athleteCount: match.athlete2 ? 2 : 1,
            athleteSchedule: this.generateAthleteSchedule([match], currentTime, wod.estimatedDuration || 15, timezone)
          };
          
          logger.info('Session created', {
            sessionId: session.sessionId,
            heatNumber,
            wodId: wod.wodId,
            wodName: wod.name,
            athleteCount: session.athleteCount,
            duration: session.duration,
            startTime: session.startTime
          });
          
          sessions.push(session);
          currentTime += session.duration + transitionTime;
        }
      }
    } else {
      // Original logic for HEATS and SIMULTANEOUS modes
      for (const wod of wods) {
        for (const category of categories) {
          const categoryAthletes = athletes.filter(a => a.categoryId === category.categoryId);
          
          
          if (competitionMode === 'SIMULTANEOUS') {
            // All athletes at once
            const session = {
              sessionId: `${dayId}-${wod.wodId}-${category.categoryId}`,
              wodId: wod.wodId, 
              categoryId: category.categoryId,
              competitionMode: 'SIMULTANEOUS',
              startTime: this.minutesToTime(currentTime),
              startTimeUTC: this.convertToUTC(this.minutesToTime(currentTime), timezone),
              duration: wod.estimatedDuration || 20,
              athletes: categoryAthletes,
              athleteCount: categoryAthletes.length,
              athleteSchedule: categoryAthletes.map(athlete => ({
                athleteId: athlete.userId,
                athleteName: `${athlete.firstName} ${athlete.lastName}`,
                startTime: this.minutesToTime(currentTime),
                startTimeUTC: this.convertToUTC(this.minutesToTime(currentTime), timezone),
                endTime: this.minutesToTime(currentTime + (wod.estimatedDuration || 20)),
                station: categoryAthletes.indexOf(athlete) + 1
              }))
            };
            sessions.push(session);
            currentTime += session.duration + transitionTime;
            
          } else {
            // Traditional heats
            const heats = this.createHeats(categoryAthletes, athletesPerHeat);
            const session = {
              sessionId: `${dayId}-${wod.wodId}-${category.categoryId}`,
              wodId: wod.wodId, 
              categoryId: category.categoryId,
              competitionMode: 'HEATS',
              startTime: this.minutesToTime(currentTime),
              startTimeUTC: this.convertToUTC(this.minutesToTime(currentTime), timezone),
              duration: heats.length * (wod.estimatedDuration || 20),
              heats,
              athleteCount: categoryAthletes.length,
              heatCount: heats.length,
              athleteSchedule: this.generateHeatAthleteSchedule(heats, currentTime, wod.estimatedDuration || 20, timezone)
            };
            sessions.push(session);
            currentTime += session.duration + transitionTime;
          }
        }
        currentTime += setupTime; // Setup time between WODs
      }
    }

    return {
      dayId, 
      sessions,
      totalDuration: (currentTime - this.timeToMinutes(config.startTime)) / 60,
      withinTimeLimit: (currentTime - this.timeToMinutes(config.startTime)) <= (config.maxHours * 60)
    };
  }

  // Create single versus match for specific heat
  createSingleVersusMatch(athletes, heatNumber) {
    const shuffled = [...athletes].sort(() => Math.random() - 0.5);
    const athlete1 = shuffled[0];
    const athlete2 = shuffled[1] || null;
    
    return {
      matchId: `heat-${heatNumber}`,
      heatNumber,
      athlete1,
      athlete2,
      bye: !athlete2
    };
  }

  // Create versus matches (1v1) with specified number of heats for elimination bracket
  createVersusMatches(athletes, numberOfHeats = null) {
    const matches = [];
    const shuffled = [...athletes].sort(() => Math.random() - 0.5);
    
    // If numberOfHeats specified, create bracket structure for elimination
    if (numberOfHeats) {
      const athletesPerMatch = 2;
      const totalMatches = numberOfHeats;
      
      // Create matches up to the specified number of heats
      for (let i = 0; i < totalMatches && i * athletesPerMatch < shuffled.length; i++) {
        const athlete1 = shuffled[i * athletesPerMatch];
        const athlete2 = shuffled[i * athletesPerMatch + 1];
        
        matches.push({
          matchId: `heat-${i + 1}`,
          heatNumber: i + 1,
          athlete1,
          athlete2: athlete2 || null,
          bye: !athlete2
        });
      }
    } else {
      // Original logic for all athletes
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          matches.push({
            matchId: `match-${Math.floor(i/2) + 1}`,
            athlete1: shuffled[i],
            athlete2: shuffled[i + 1]
          });
        } else {
          // Bye for odd number
          matches.push({
            matchId: `match-${Math.floor(i/2) + 1}`,
            athlete1: shuffled[i],
            athlete2: null,
            bye: true
          });
        }
      }
    }
    return matches;
  }

  // Generate athlete schedule for versus matches
  generateAthleteSchedule(matches, startTime, duration, timezone) {
    const schedule = [];
    matches.forEach((match, index) => {
      const matchStartTime = startTime + (index * duration);
      
      schedule.push({
        athleteId: match.athlete1.userId,
        athleteName: `${match.athlete1.firstName} ${match.athlete1.lastName}`,
        matchId: match.matchId,
        opponent: match.athlete2 ? `${match.athlete2.firstName} ${match.athlete2.lastName}` : 'BYE',
        startTime: this.minutesToTime(matchStartTime),
        startTimeUTC: this.convertToUTC(this.minutesToTime(matchStartTime), timezone),
        endTime: this.minutesToTime(matchStartTime + duration)
      });
      
      if (match.athlete2) {
        schedule.push({
          athleteId: match.athlete2.userId,
          athleteName: `${match.athlete2.firstName} ${match.athlete2.lastName}`,
          matchId: match.matchId,
          opponent: `${match.athlete1.firstName} ${match.athlete1.lastName}`,
          startTime: this.minutesToTime(matchStartTime),
          startTimeUTC: this.convertToUTC(this.minutesToTime(matchStartTime), timezone),
          endTime: this.minutesToTime(matchStartTime + duration)
        });
      }
    });
    return schedule;
  }

  // Generate athlete schedule for heats
  generateHeatAthleteSchedule(heats, startTime, duration, timezone) {
    const schedule = [];
    heats.forEach((heat, heatIndex) => {
      const heatStartTime = startTime + (heatIndex * duration);
      
      heat.athletes.forEach(athlete => {
        schedule.push({
          athleteId: athlete.userId,
          athleteName: `${athlete.firstName} ${athlete.lastName}`,
          heatId: heat.heatId,
          heatNumber: heatIndex + 1,
          startTime: this.minutesToTime(heatStartTime),
          startTimeUTC: this.convertToUTC(this.minutesToTime(heatStartTime), timezone),
          endTime: this.minutesToTime(heatStartTime + duration),
          lane: heat.athletes.indexOf(athlete) + 1
        });
      });
    });
    return schedule;
  }

  // CRUD Operations
  async saveSchedule(eventId, scheduleData) {
    const schedule = {
      ...scheduleData,
      eventId,
      scheduleId: scheduleData.scheduleId || `schedule-${Date.now()}`,
      updatedAt: new Date().toISOString()
    };

    await this.dynamodb.send(new PutCommand({
      TableName: SCHEDULES_TABLE,
      Item: schedule
    }));

    return schedule;
  }

  async getSchedule(eventId, scheduleId) {
    const { Item } = await this.dynamodb.send(new GetCommand({
      TableName: SCHEDULES_TABLE,
      Key: { eventId, scheduleId }
    }));
    return Item;
  }

  async updateSchedule(eventId, scheduleId, updates) {
    const updateExpressions = [];
    const attributeValues = {};
    const attributeNames = {};

    Object.keys(updates).forEach(key => {
      updateExpressions.push(`#${key} = :${key}`);
      attributeNames[`#${key}`] = key;
      attributeValues[`:${key}`] = updates[key];
    });

    attributeValues[':updatedAt'] = new Date().toISOString();
    updateExpressions.push('#updatedAt = :updatedAt');
    attributeNames['#updatedAt'] = 'updatedAt';

    await this.dynamodb.send(new UpdateCommand({
      TableName: SCHEDULES_TABLE,
      Key: { eventId, scheduleId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues
    }));

    return await this.getSchedule(eventId, scheduleId);
  }

  async deleteSchedule(eventId, scheduleId) {
    await this.dynamodb.send(new DeleteCommand({
      TableName: SCHEDULES_TABLE,
      Key: { eventId, scheduleId }
    }));
    return { success: true };
  }

  async listSchedules(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: SCHEDULES_TABLE,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));
    return Items || [];
  }

  // Athlete elimination methods
  async eliminateAthletes(eventId, filterId, eliminationConfig) {
    const { eliminationCount, eliminationType = 'BOTTOM_SCORES' } = eliminationConfig;
    
    // Get current scores for the filter
    const scores = await this.getFilterScores(eventId, filterId);
    
    // Sort athletes based on elimination type
    let sortedAthletes;
    switch (eliminationType) {
      case 'BOTTOM_SCORES':
        sortedAthletes = scores.sort((a, b) => a.score - b.score);
        break;
      case 'TOP_SCORES':
        sortedAthletes = scores.sort((a, b) => b.score - a.score);
        break;
      case 'RANDOM':
        sortedAthletes = scores.sort(() => Math.random() - 0.5);
        break;
      default:
        sortedAthletes = scores.sort((a, b) => a.score - b.score);
    }
    
    // Select athletes to eliminate
    const eliminatedAthletes = sortedAthletes.slice(0, eliminationCount);
    const remainingAthletes = sortedAthletes.slice(eliminationCount);
    
    // Update filter with elimination results
    await this.updateFilterElimination(eventId, filterId, {
      eliminatedAthletes: eliminatedAthletes.map(a => a.athleteId),
      remainingAthletes: remainingAthletes.map(a => a.athleteId),
      eliminatedAt: new Date().toISOString()
    });
    
    return {
      eliminated: eliminatedAthletes,
      remaining: remainingAthletes,
      eliminationCount
    };
  }

  async getFilterScores(eventId, filterId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: SCORES_TABLE,
      KeyConditionExpression: 'eventId = :eventId',
      FilterExpression: 'filterId = :filterId',
      ExpressionAttributeValues: {
        ':eventId': eventId,
        ':filterId': filterId
      }
    }));
    
    return Items || [];
  }

  async updateFilterElimination(eventId, filterId, eliminationData) {
    await this.dynamodb.send(new UpdateCommand({
      TableName: CLASSIFICATION_FILTERS_TABLE,
      Key: { eventId, filterId },
      UpdateExpression: 'SET eliminatedAthletes = :eliminated, remainingAthletes = :remaining, eliminatedAt = :eliminatedAt, #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':eliminated': eliminationData.eliminatedAthletes,
        ':remaining': eliminationData.remainingAthletes,
        ':eliminatedAt': eliminationData.eliminatedAt,
        ':status': 'COMPLETED'
      }
    }));
  }

  async processFilterProgression(eventId, scheduleId) {
    // Get schedule with filters
    const schedule = await this.getSchedule(eventId, scheduleId);
    if (!schedule || !schedule.filters) return { error: 'No filters found' };
    
    const results = [];
    let activeAthletes = schedule.athletes || [];
    
    for (const filter of schedule.filters) {
      if (filter.eliminationCount && filter.eliminationCount > 0) {
        // Check if filter has scores
        const scores = await this.getFilterScores(eventId, filter.filterId);
        
        if (scores.length > 0) {
          const elimination = await this.eliminateAthletes(eventId, filter.filterId, {
            eliminationCount: filter.eliminationCount,
            eliminationType: filter.eliminationType
          });
          
          activeAthletes = elimination.remaining.map(a => ({ userId: a.athleteId }));
          results.push({
            filterId: filter.filterId,
            filterName: filter.name,
            eliminated: elimination.eliminated.length,
            remaining: elimination.remaining.length
          });
        }
      }
    }
    
    // Update schedule with final athlete list
    await this.updateSchedule(eventId, scheduleId, { 
      activeAthletes,
      progressionResults: results,
      lastProgressionAt: new Date().toISOString()
    });
    
    return { results, activeAthletes: activeAthletes.length };
  }

  // Utility functions
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  convertToUTC(localTime, timezone) {
    // Simple timezone conversion - in production use proper timezone library
    const timezoneOffsets = {
      'UTC': 0, 'EST': -5, 'CST': -6, 'MST': -7, 'PST': -8,
      'CET': 1, 'JST': 9, 'AEST': 10
    };
    
    const offset = timezoneOffsets[timezone] || 0;
    const [hours, minutes] = localTime.split(':').map(Number);
    const utcHours = (hours - offset + 24) % 24;
    return `${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  createHeats(athletes, athletesPerHeat) {
    const heats = [];
    for (let i = 0; i < athletes.length; i += athletesPerHeat) {
      heats.push({
        heatId: `heat-${Math.floor(i / athletesPerHeat) + 1}`,
        athletes: athletes.slice(i, i + athletesPerHeat)
      });
    }
    return heats;
  }
}

// Lambda handler with CRUD operations
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, resource, pathParameters, body, queryStringParameters } = event;
    const requestBody = body ? JSON.parse(body) : {};
    const scheduler = new CompetitionScheduler(dynamodb);

    const eventId = pathParameters?.eventId;
    const scheduleId = pathParameters?.scheduleId;

    switch (resource) {
      // Generate new schedule
      case '/scheduler/{eventId}':
        if (httpMethod === 'POST') {
          const schedule = await scheduler.generateSchedule(eventId, requestBody);
          return { statusCode: 201, headers, body: JSON.stringify(schedule) };
        }
        if (httpMethod === 'GET') {
          const schedules = await scheduler.listSchedules(eventId);
          return { statusCode: 200, headers, body: JSON.stringify(schedules) };
        }
        break;

      // CRUD operations on specific schedule
      case '/scheduler/{eventId}/{scheduleId}':
        if (httpMethod === 'GET') {
          const schedule = await scheduler.getSchedule(eventId, scheduleId);
          return { 
            statusCode: schedule ? 200 : 404, 
            headers, 
            body: JSON.stringify(schedule || { error: 'Schedule not found' }) 
          };
        }
        if (httpMethod === 'PUT') {
          const updated = await scheduler.updateSchedule(eventId, scheduleId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }
        if (httpMethod === 'DELETE') {
          const result = await scheduler.deleteSchedule(eventId, scheduleId);
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }
        break;

      // Save schedule (create or update)
      case '/scheduler/{eventId}/save':
        if (httpMethod === 'POST') {
          const saved = await scheduler.saveSchedule(eventId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(saved) };
        }
        break;

      // Athlete elimination endpoints
      case '/competitions/{eventId}/schedule/{scheduleId}/eliminate':
        if (httpMethod === 'POST') {
          const { filterId, eliminationCount, eliminationType } = requestBody;
          const result = await scheduler.eliminateAthletes(eventId, filterId, {
            eliminationCount,
            eliminationType
          });
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }
        break;

      case '/competitions/{eventId}/schedule/{scheduleId}/progression':
        if (httpMethod === 'POST') {
          const result = await scheduler.processFilterProgression(eventId, scheduleId);
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }
        break;

      default:
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }

  } catch (error) {
    logger.error('Scheduler error details', { 
      error: error.message, 
      stack: error.stack,
      eventId,
      httpMethod,
      resource,
      requestBody: JSON.stringify(requestBody).substring(0, 500)
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: 'Check CloudWatch logs for more information',
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Export both the class and the handler
module.exports = { 
  CompetitionScheduler,
  handler: async (event) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    try {
      const { httpMethod, resource, pathParameters, body, queryStringParameters } = event;
      const requestBody = body ? JSON.parse(body) : {};
      
      // Debug logging
      console.log('Scheduler Debug:', {
        httpMethod,
        resource,
        pathParameters,
        path: event.path
      });
      
      // Initialize DynamoDB client
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({});
      const dynamodb = DynamoDBDocumentClient.from(client);
      
      const scheduler = new CompetitionScheduler(dynamodb);

      // Handle proxy pattern - extract eventId and scheduleId from proxy parameter
      const proxy = pathParameters?.proxy;
      const pathParts = proxy ? proxy.split('/') : [];
      const eventId = pathParts[0];
      const scheduleId = pathParts[1];

      console.log('Parsed path:', { proxy, pathParts, eventId, scheduleId });

      // Handle different endpoints based on path structure
      if (eventId && !scheduleId) {
        // /scheduler/{eventId}
        if (httpMethod === 'POST') {
          const schedule = await scheduler.generateSchedule(eventId, requestBody);
          return { statusCode: 201, headers, body: JSON.stringify(schedule) };
        }
        if (httpMethod === 'GET') {
          const schedules = await scheduler.listSchedules(eventId);
          return { statusCode: 200, headers, body: JSON.stringify(schedules) };
        }
      } else if (eventId && scheduleId && scheduleId !== 'save') {
        // /scheduler/{eventId}/{scheduleId}
        if (httpMethod === 'GET') {
          const schedule = await scheduler.getSchedule(eventId, scheduleId);
          return { 
            statusCode: schedule ? 200 : 404, 
            headers, 
            body: JSON.stringify(schedule || { error: 'Schedule not found' }) 
          };
        }
        if (httpMethod === 'PUT') {
          const updated = await scheduler.updateSchedule(eventId, scheduleId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }
        if (httpMethod === 'DELETE') {
          const result = await scheduler.deleteSchedule(eventId, scheduleId);
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }
      } else if (eventId && pathParts[1] === 'save') {
        // /scheduler/{eventId}/save
        if (httpMethod === 'POST') {
          const saved = await scheduler.saveSchedule(eventId, requestBody);
          return { statusCode: 200, headers, body: JSON.stringify(saved) };
        }
      }

      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

    } catch (error) {
      console.error('Scheduler error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
};

// Ensure handler is properly exported
exports.handler = module.exports.handler;
