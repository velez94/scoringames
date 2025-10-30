const { TimeSlot } = require('../../value-objects/TimeSlot');

class HeatsMode {
  constructor(config) {
    this.athletesPerHeat = config.athletesPerHeat || 8;
    this.wodDuration = config.wodDuration || 20;
  }

  schedule(athletes, startTime) {
    const heats = this._createHeats(athletes);
    const duration = heats.length * this.wodDuration;
    const athleteSchedule = this._generateAthleteSchedule(heats, startTime);

    return {
      heats,
      duration,
      athleteSchedule
    };
  }

  recalculateSchedule(existingSchedule, newStartTime) {
    const startTimeSlot = TimeSlot.fromString(newStartTime);
    
    return existingSchedule.map((athlete, index) => {
      const heatIndex = Math.floor(index / this.athletesPerHeat);
      const heatStartTime = startTimeSlot.addMinutes(heatIndex * this.wodDuration);
      
      return {
        ...athlete,
        startTime: heatStartTime.toString(),
        endTime: heatStartTime.addMinutes(this.wodDuration).toString()
      };
    });
  }

  _createHeats(athletes) {
    const heats = [];
    for (let i = 0; i < athletes.length; i += this.athletesPerHeat) {
      heats.push({
        heatId: `heat-${Math.floor(i / this.athletesPerHeat) + 1}`,
        athletes: athletes.slice(i, i + this.athletesPerHeat)
      });
    }
    return heats;
  }

  _generateAthleteSchedule(heats, startTime) {
    const schedule = [];
    const startTimeSlot = TimeSlot.fromString(startTime.toString());

    heats.forEach((heat, heatIndex) => {
      const heatStartTime = startTimeSlot.addMinutes(heatIndex * this.wodDuration);
      const heatEndTime = heatStartTime.addMinutes(this.wodDuration);

      heat.athletes.forEach((athlete, laneIndex) => {
        schedule.push({
          athleteId: athlete.userId,
          athleteName: `${athlete.firstName} ${athlete.lastName}`,
          heatId: heat.heatId,
          heatNumber: heatIndex + 1,
          lane: laneIndex + 1,
          startTime: heatStartTime.toString(),
          endTime: heatEndTime.toString()
        });
      });
    });

    return schedule;
  }
}

module.exports = { HeatsMode };
