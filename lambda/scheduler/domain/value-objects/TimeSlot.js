class TimeSlot {
  constructor(hours, minutes) {
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Invalid time values');
    }
    this.hours = hours;
    this.minutes = minutes;
  }

  static fromString(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new TimeSlot(hours, minutes);
  }

  static fromMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return new TimeSlot(hours, minutes);
  }

  addMinutes(minutesToAdd) {
    const totalMinutes = this.toMinutes() + minutesToAdd;
    return TimeSlot.fromMinutes(totalMinutes);
  }

  toMinutes() {
    return this.hours * 60 + this.minutes;
  }

  toString() {
    return `${this.hours.toString().padStart(2, '0')}:${this.minutes.toString().padStart(2, '0')}`;
  }

  equals(other) {
    return this.hours === other.hours && this.minutes === other.minutes;
  }
}

module.exports = { TimeSlot };
