const createInMemoryRepository = require('./inMemoryRepository');

// Antrean demonstrasi mengacu pada reservasi dan jadwal demonstrasi yang tersedia.
const demonstrationQueues = [];

function createQueueRepository() {
  const repository = createInMemoryRepository(demonstrationQueues);
  let nextId = demonstrationQueues.length + 1;

  return {
    findAll() { return repository.findAll(); },
    findById(id) { return repository.findById(id); },
    findByReservationId(reservationId) {
      return repository.findAll().find((queue) => queue.reservationId === reservationId) || null;
    },
    createForReservation(payload) {
      if (this.findByReservationId(payload.reservationId)) {
        const error = new Error('Reservasi sudah memiliki antrean.');
        error.status = 409;
        throw error;
      }

      const matchingQueues = repository.findAll().filter((queue) => (
        queue.doctorId === payload.doctorId
        && queue.date === payload.date
        && queue.shift === payload.shift
      ));
      const usedNumbers = matchingQueues.map((queue) => Number(queue.queueNumber)).filter(Number.isFinite);
      const nextNumber = String(Math.max(0, ...usedNumbers) + 1).padStart(3, '0');
      const id = `queue-demo-${String(nextId).padStart(3, '0')}`;
      nextId += 1;

      return repository.create({ id, ...payload, queueNumber: nextNumber });
    },
    update(id, payload) { return repository.update(id, payload); },
    remove(id) { return repository.remove(id); },
  };
}

module.exports = createQueueRepository;
