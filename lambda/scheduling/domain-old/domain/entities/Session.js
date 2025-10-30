const { CompetitionModeFactory } = require('../services/CompetitionModeFactory');

class Session {
  constructor(sessionId, wod, category, config) {
    this.sessionId = sessionId;
    this.wodId = wod.wodId;
    this.wodName = wod.name;
    this.categoryId = category.categoryId;
    this.categoryName = category.name;
    this.competitionMode = config.competitionMode || 'HEATS';
    this.config = config;
    this.heats = [];
    this.matches = [];
    this.athleteSchedule = [];
  }

  static fromSnapshot(data) {
    const session = Object.create(Session.prototype);
    return Object.assign(session, data);
  }

  scheduleAthletes(athletes, startTime) {
    const modeHandler = CompetitionModeFactory.create(this.competitionMode, this.config);
    const result = modeHandler.schedule(athletes, startTime);
    
    this.heats = result.heats || [];
    this.matches = result.matches || [];
    this.athleteSchedule = result.athleteSchedule;
    this.startTime = startTime.toString();
    this.duration = result.duration;
  }

  update(updates) {
    if (updates.startTime) {
      this.startTime = updates.startTime;
      this._recalculateAthleteSchedule();
    }
    if (updates.duration) {
      this.duration = updates.duration;
    }
  }

  getDuration() {
    return this.duration || 0;
  }

  isValid() {
    return this.athleteSchedule.length > 0 && this.duration > 0;
  }

  _recalculateAthleteSchedule() {
    // Recalculate athlete start times based on new session start time
    const modeHandler = CompetitionModeFactory.create(this.competitionMode, this.config);
    this.athleteSchedule = modeHandler.recalculateSchedule(
      this.athleteSchedule, 
      this.startTime
    );
  }

  toSnapshot() {
    return {
      sessionId: this.sessionId,
      wodId: this.wodId,
      wodName: this.wodName,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      competitionMode: this.competitionMode,
      startTime: this.startTime,
      duration: this.duration,
      heats: this.heats,
      matches: this.matches,
      athleteSchedule: this.athleteSchedule
    };
  }
}

module.exports = { Session };
