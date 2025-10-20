const { DaySchedule } = require('./DaySchedule');
const { ScheduleId } = require('../value-objects/ScheduleId');
const { Duration } = require('../value-objects/Duration');

class Schedule {
  constructor(eventId, config) {
    this.scheduleId = ScheduleId.generate();
    this.eventId = eventId;
    this.config = config;
    this.days = [];
    this.status = 'DRAFT';
    this.createdAt = new Date().toISOString();
  }

  static fromSnapshot(data) {
    const schedule = Object.create(Schedule.prototype);
    Object.assign(schedule, data);
    schedule.days = data.days.map(day => DaySchedule.fromSnapshot(day));
    return schedule;
  }

  addDay(dayData, athletes, categories, wods) {
    const daySchedule = new DaySchedule(dayData, this.config);
    daySchedule.generateSessions(athletes, categories, wods);
    
    this.days.push(daySchedule);
    this._validateTimeConstraints();
    
    return daySchedule;
  }

  publish() {
    if (!this._canPublish()) {
      throw new Error('Schedule cannot be published - validation failed');
    }
    this.status = 'PUBLISHED';
    this.publishedAt = new Date().toISOString();
  }

  unpublish() {
    this.status = 'DRAFT';
    delete this.publishedAt;
  }

  updateSession(sessionId, updates) {
    const session = this._findSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    session.update(updates);
    this._validateTimeConstraints();
  }

  getTotalDuration() {
    return this.days.reduce((total, day) => total + day.getTotalDuration(), 0);
  }

  _validateTimeConstraints() {
    const maxHours = this.config.maxDayHours || 10;
    const violations = this.days.filter(day => !day.isWithinTimeLimit(maxHours));
    
    if (violations.length > 0) {
      throw new Error(`Time constraints violated for days: ${violations.map(d => d.dayId).join(', ')}`);
    }
  }

  _canPublish() {
    return this.days.length > 0 && this.days.every(day => day.isValid());
  }

  _findSession(sessionId) {
    for (const day of this.days) {
      const session = day.findSession(sessionId);
      if (session) return session;
    }
    return null;
  }

  toSnapshot() {
    return {
      scheduleId: this.scheduleId,
      eventId: this.eventId,
      config: this.config,
      days: this.days.map(day => day.toSnapshot()),
      status: this.status,
      createdAt: this.createdAt,
      publishedAt: this.publishedAt
    };
  }
}

module.exports = { Schedule };
