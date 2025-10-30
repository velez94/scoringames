const { TimeSlot } = require('../../value-objects/TimeSlot');
const { ProgressiveTournament } = require('../ProgressiveTournament');

class VersusMode {
  constructor(config) {
    this.wodDuration = config.wodDuration || 15;
    this.concurrentMatches = config.concurrentMatches || 1;
    this.eliminationRules = config.eliminationRules;
    this.progressiveTournament = config.progressiveTournament;
    console.log('VersusMode initialized:', { concurrentMatches: this.concurrentMatches, config });
  }

  schedule(athletes, startTime) {
    // Create or restore progressive tournament
    const tournament = this.progressiveTournament || 
      new ProgressiveTournament(athletes.length, this.eliminationRules);
    
    // Create matches for current stage
    const matches = tournament.createCurrentStageMatches(athletes);
    const duration = Math.ceil(matches.length / this.concurrentMatches) * this.wodDuration;
    const athleteSchedule = this._generateAthleteSchedule(matches, startTime);

    return {
      matches,
      duration,
      athleteSchedule,
      tournament: tournament.toSnapshot(),
      bracket: tournament.getTournamentBracket()
    };
  }

  async processResults(matchResults, scoreService) {
    if (!this.progressiveTournament) {
      throw new Error('No active tournament to process results');
    }

    const tournament = ProgressiveTournament.fromSnapshot(this.progressiveTournament);
    const result = await tournament.processStageResults(matchResults, scoreService);
    
    // Update tournament state
    this.progressiveTournament = tournament.toSnapshot();
    
    return {
      ...result,
      tournament: this.progressiveTournament,
      bracket: tournament.getTournamentBracket()
    };
  }

  getNextStageSchedule(startTime) {
    if (!this.progressiveTournament) return null;
    
    const tournament = ProgressiveTournament.fromSnapshot(this.progressiveTournament);
    const currentStage = tournament.getCurrentStage();
    
    if (!currentStage) return null;
    
    const advancingAthletes = currentStage.getAdvancingAthletes();
    return this.schedule(advancingAthletes, startTime);
  }

  recalculateSchedule(existingSchedule, newStartTime) {
    const startTimeSlot = TimeSlot.fromString(newStartTime);
    
    return existingSchedule.map((athlete, index) => {
      const matchIndex = Math.floor(index / 2);
      const timeSlotIndex = Math.floor(matchIndex / this.concurrentMatches);
      const matchStartTime = startTimeSlot.addMinutes(timeSlotIndex * this.wodDuration);
      
      return {
        ...athlete,
        startTime: matchStartTime.toString(),
        endTime: matchStartTime.addMinutes(this.wodDuration).toString()
      };
    });
  }

  _generateAthleteSchedule(matches, startTime) {
    const schedule = [];
    const startTimeSlot = TimeSlot.fromString(startTime.toString());

    matches.forEach((match, index) => {
      const timeSlotIndex = Math.floor(index / this.concurrentMatches);
      const matchStartTime = startTimeSlot.addMinutes(timeSlotIndex * this.wodDuration);
      const matchEndTime = matchStartTime.addMinutes(this.wodDuration);

      // Add athlete1
      schedule.push({
        athleteId: match.athlete1.userId,
        athleteName: `${match.athlete1.firstName} ${match.athlete1.lastName}`,
        matchId: match.matchId,
        opponent: match.athlete2 ? `${match.athlete2.firstName} ${match.athlete2.lastName}` : 'BYE',
        startTime: matchStartTime.toString(),
        endTime: matchEndTime.toString()
      });

      // Add athlete2 if exists
      if (match.athlete2) {
        schedule.push({
          athleteId: match.athlete2.userId,
          athleteName: `${match.athlete2.firstName} ${match.athlete2.lastName}`,
          matchId: match.matchId,
          opponent: `${match.athlete1.firstName} ${match.athlete1.lastName}`,
          startTime: matchStartTime.toString(),
          endTime: matchEndTime.toString()
        });
      }
    });

    return schedule;
  }
}

module.exports = { VersusMode };
