class Duration {
  constructor(minutes) {
    if (minutes < 0) {
      throw new Error('Duration cannot be negative');
    }
    this.minutes = minutes;
  }

  static fromHours(hours) {
    return new Duration(hours * 60);
  }

  static fromMinutes(minutes) {
    return new Duration(minutes);
  }

  add(other) {
    return new Duration(this.minutes + other.minutes);
  }

  toMinutes() {
    return this.minutes;
  }

  toHours() {
    return this.minutes / 60;
  }

  isLessThan(other) {
    return this.minutes < other.minutes;
  }

  equals(other) {
    return this.minutes === other.minutes;
  }
}

module.exports = { Duration };
