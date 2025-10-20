class ScheduleRepository {
  async save(schedule) {
    throw new Error('Method must be implemented');
  }

  async findById(scheduleId) {
    throw new Error('Method must be implemented');
  }

  async findByEventId(eventId) {
    throw new Error('Method must be implemented');
  }

  async findPublishedByEventId(eventId) {
    throw new Error('Method must be implemented');
  }

  async delete(scheduleId) {
    throw new Error('Method must be implemented');
  }
}

module.exports = { ScheduleRepository };
