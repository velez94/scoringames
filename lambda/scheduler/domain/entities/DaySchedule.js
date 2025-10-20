const { Session } = require('./Session');
const { TimeSlot } = require('../value-objects/TimeSlot');

class DaySchedule {
  constructor(dayData, config) {
    this.dayId = dayData.dayId;
    this.name = dayData.name;
    this.date = dayData.date;
    this.sessions = [];
    this.config = config;
    this.currentTime = TimeSlot.fromString(config.startTime || '08:00');
  }

  static fromSnapshot(data) {
    const daySchedule = Object.create(DaySchedule.prototype);
    Object.assign(daySchedule, data);
    daySchedule.sessions = data.sessions.map(s => Session.fromSnapshot(s));
    daySchedule.currentTime = TimeSlot.fromMinutes(data.currentTime);
    return daySchedule;
  }

  generateSessions(athletes, categories, wods) {
    for (const wod of wods) {
      for (const category of categories) {
        const categoryAthletes = athletes.filter(a => a.categoryId === category.categoryId);
        if (categoryAthletes.length === 0) continue;

        const session = this._createSession(wod, category, categoryAthletes);
        this.sessions.push(session);
        this._advanceTime(session.getDuration());
      }
      this._addSetupTime();
    }
  }

  findSession(sessionId) {
    return this.sessions.find(s => s.sessionId === sessionId);
  }

  getTotalDuration() {
    return this.sessions.reduce((total, session) => total + session.getDuration(), 0);
  }

  isWithinTimeLimit(maxHours) {
    const totalMinutes = this.getTotalDuration();
    const maxMinutes = maxHours * 60;
    return totalMinutes <= maxMinutes;
  }

  isValid() {
    return this.sessions.length > 0 && this.sessions.every(s => s.isValid());
  }

  _createSession(wod, category, athletes) {
    const sessionId = `${this.dayId}-${wod.wodId}-${category.categoryId}`;
    const session = new Session(sessionId, wod, category, this.config);
    
    session.scheduleAthletes(athletes, this.currentTime);
    return session;
  }

  _advanceTime(minutes) {
    this.currentTime = this.currentTime.addMinutes(minutes + (this.config.transitionTime || 5));
  }

  _addSetupTime() {
    this.currentTime = this.currentTime.addMinutes(this.config.setupTime || 10);
  }

  toSnapshot() {
    return {
      dayId: this.dayId,
      name: this.name,
      date: this.date,
      sessions: this.sessions.map(s => s.toSnapshot()),
      currentTime: this.currentTime.toMinutes()
    };
  }
}

module.exports = { DaySchedule };
