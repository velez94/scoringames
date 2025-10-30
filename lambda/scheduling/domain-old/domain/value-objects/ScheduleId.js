class ScheduleId {
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('ScheduleId must be a non-empty string');
    }
    this.value = value;
  }

  static generate() {
    return new ScheduleId(`schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  static fromString(value) {
    return new ScheduleId(value);
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return this.value === other.value;
  }
}

module.exports = { ScheduleId };
