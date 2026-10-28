const createInMemoryRepository = require('./inMemoryRepository');

function createScheduleRepository(initialRecords = []) {
  const repository = createInMemoryRepository(initialRecords);

  return {
    findAll() { return repository.findAll(); },
    findById(id) { return repository.findById(id); },
    create(payload) { return repository.create(payload); },
    update(id, payload) { return repository.update(id, payload); },
    tryBook(id, doctorId) {
      const schedule = repository.findById(id);
      if (!schedule) return { outcome: 'not-found' };
      if (schedule.doctorId !== doctorId) return { outcome: 'doctor-mismatch' };
      if (!schedule.isActive) return { outcome: 'inactive' };
      if (schedule.bookedCount >= schedule.capacity) return { outcome: 'full' };

      const updated = repository.update(id, { bookedCount: schedule.bookedCount + 1 });
      return { outcome: 'booked', schedule: updated };
    },
    releaseBooking(id) {
      const schedule = repository.findById(id);
      if (!schedule) return null;
      return repository.update(id, { bookedCount: Math.max(0, schedule.bookedCount - 1) });
    },
  };
}

module.exports = createScheduleRepository;
