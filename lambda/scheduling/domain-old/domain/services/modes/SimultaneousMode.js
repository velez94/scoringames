const { TimeSlot } = require('../../value-objects/TimeSlot');

class SimultaneousMode {
  constructor(config) {
    this.wodDuration = config.wodDuration || 20;
  }

  schedule(athletes, startTime) {
    const duration = this.wodDuration;
    const athleteSchedule = this._generateAthleteSchedule(athletes, startTime);

    return {
      duration,
      athleteSchedule
    };
  }

  recalculateSchedule(existingSchedule, newStartTime) {
    const startTimeSlot = TimeSlot.fromString(newStartTime);
    const endTimeSlot = startTimeSlot.addMinutes(this.wodDuration);
    
    return existingSchedule.map(athlete => ({
      ...athlete,
      startTime: startTimeSlot.toString(),
      endTime: endTimeSlot.toString()
    }));
  }

  _generateAthleteSchedule(athletes, startTime) {
    const startTimeSlot = TimeSlot.fromString(startTime.toString());
    const endTimeSlot = startTimeSlot.addMinutes(this.wodDuration);

    return athletes.map((athlete, index) => ({
      athleteId: athlete.userId,
      athleteName: `${athlete.firstName} ${athlete.lastName}`,
      station: index + 1,
      startTime: startTimeSlot.toString(),
      endTime: endTimeSlot.toString()
    }));
  }
}

module.exports = { SimultaneousMode };
