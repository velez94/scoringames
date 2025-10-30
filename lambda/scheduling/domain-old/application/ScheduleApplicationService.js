const { Schedule } = require('../domain/entities/Schedule');
const { EventDataService } = require('./EventDataService');
const { ScoreService } = require('./ScoreService');

class ScheduleApplicationService {
  constructor(scheduleRepository, eventDataService, eventPublisher, dynamoClient) {
    this.scheduleRepository = scheduleRepository;
    this.eventDataService = eventDataService;
    this.eventPublisher = eventPublisher;
    this.scoreService = new ScoreService(dynamoClient);
  }

  async generateSchedule(eventId, config) {
    // Get event data from external service
    const eventData = await this.eventDataService.getEventData(eventId);
    
    // Create schedule domain entity
    const schedule = new Schedule(eventId, config);
    
    // Generate schedule using domain logic
    for (const day of eventData.days) {
      schedule.addDay(day, eventData.athletes, eventData.categories, eventData.wods);
    }

    // Save schedule
    await this.scheduleRepository.save(schedule);

    // Publish domain event
    await this.eventPublisher.publish({
      eventType: 'ScheduleGenerated',
      eventId,
      scheduleId: schedule.scheduleId.toString(),
      timestamp: new Date().toISOString()
    });

    return schedule;
  }

  async publishSchedule(eventId, scheduleId) {
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    schedule.publish();
    await this.scheduleRepository.save(schedule);

    await this.eventPublisher.publish({
      eventType: 'SchedulePublished',
      eventId,
      scheduleId,
      timestamp: new Date().toISOString()
    });

    return schedule;
  }

  async unpublishSchedule(eventId, scheduleId) {
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    schedule.unpublish();
    await this.scheduleRepository.save(schedule);

    await this.eventPublisher.publish({
      eventType: 'ScheduleUnpublished',
      eventId,
      scheduleId,
      timestamp: new Date().toISOString()
    });

    return schedule;
  }
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Apply updates using domain logic
    if (updates.sessions) {
      for (const sessionUpdate of updates.sessions) {
        schedule.updateSession(sessionUpdate.sessionId, sessionUpdate.updates);
      }
    }

    await this.scheduleRepository.save(schedule);

    await this.eventPublisher.publish({
      eventType: 'ScheduleUpdated',
      eventId,
      scheduleId,
      timestamp: new Date().toISOString()
    });

    return schedule;
  }

  async getSchedule(eventId, scheduleId) {
    return await this.scheduleRepository.findById(eventId, scheduleId);
  }

  async getSchedulesByEvent(eventId) {
    return await this.scheduleRepository.findByEventId(eventId);
  }

  async getPublishedSchedules(eventId) {
    return await this.scheduleRepository.findPublishedByEventId(eventId);
  }

  async deleteSchedule(eventId, scheduleId) {
    await this.scheduleRepository.delete(eventId, scheduleId);

    await this.eventPublisher.publish({
      eventType: 'ScheduleDeleted',
      eventId,
      scheduleId,
      timestamp: new Date().toISOString()
    });
  }

  // Tournament progression methods
  async processTournamentResults(eventId, scheduleId, filterId) {
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Get match results from Score domain
    const matchResults = await this.scoreService.getMatchResults(eventId, filterId);
    
    if (matchResults.length === 0) {
      throw new Error('No match results found for this filter');
    }

    // Find the session with VERSUS mode
    let tournamentSession = null;
    for (const day of schedule.days) {
      tournamentSession = day.sessions.find(s => 
        s.competitionMode === 'VERSUS' && s.tournament
      );
      if (tournamentSession) break;
    }

    if (!tournamentSession) {
      throw new Error('No tournament session found in schedule');
    }

    // Process results using VersusMode
    const { VersusMode } = require('../domain/services/modes/VersusMode');
    const versusMode = new VersusMode({
      progressiveTournament: tournamentSession.tournament,
      wodDuration: tournamentSession.duration
    });

    const result = await versusMode.processResults(matchResults, this.scoreService);
    
    // Update session with new tournament state
    tournamentSession.tournament = result.tournament;
    tournamentSession.bracket = result.bracket;

    // Save updated schedule
    await this.scheduleRepository.save(schedule);

    // Publish tournament progression event
    await this.eventPublisher.publish({
      eventType: 'TournamentProgressed',
      eventId,
      scheduleId,
      stage: result.stage,
      stageName: result.stageName,
      advancing: result.advancing.length,
      eliminated: result.eliminated.length,
      tournamentComplete: result.tournamentComplete,
      champion: result.tournamentComplete ? result.tournament.champion : null,
      timestamp: new Date().toISOString()
    });

    return {
      schedule: schedule.toSnapshot(),
      tournamentResult: result
    };
  }

  async generateNextTournamentStage(eventId, scheduleId, startTime) {
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Find tournament session
    let tournamentSession = null;
    for (const day of schedule.days) {
      tournamentSession = day.sessions.find(s => 
        s.competitionMode === 'VERSUS' && s.tournament
      );
      if (tournamentSession) break;
    }

    if (!tournamentSession) {
      throw new Error('No tournament session found');
    }

    // Generate next stage schedule
    const { VersusMode } = require('../domain/services/modes/VersusMode');
    const versusMode = new VersusMode({
      progressiveTournament: tournamentSession.tournament,
      wodDuration: tournamentSession.duration
    });

    const nextStageSchedule = versusMode.getNextStageSchedule(startTime);
    
    if (!nextStageSchedule) {
      throw new Error('Tournament is complete or no next stage available');
    }

    // Update session with next stage
    Object.assign(tournamentSession, nextStageSchedule);

    // Save updated schedule
    await this.scheduleRepository.save(schedule);

    await this.eventPublisher.publish({
      eventType: 'TournamentStageGenerated',
      eventId,
      scheduleId,
      nextStage: nextStageSchedule.bracket.currentStage,
      matches: nextStageSchedule.matches.length,
      timestamp: new Date().toISOString()
    });

    return schedule;
  }

  async getTournamentBracket(eventId, scheduleId) {
    const schedule = await this.scheduleRepository.findById(eventId, scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Find tournament session
    for (const day of schedule.days) {
      const tournamentSession = day.sessions.find(s => 
        s.competitionMode === 'VERSUS' && s.tournament
      );
      if (tournamentSession) {
        return {
          bracket: tournamentSession.bracket,
          tournament: tournamentSession.tournament
        };
      }
    }

    throw new Error('No tournament found in schedule');
  }
}

module.exports = { ScheduleApplicationService };
