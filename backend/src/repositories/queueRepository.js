const createInMemoryRepository = require('./inMemoryRepository');

// Antrean demonstrasi mengacu pada reservasi dan jadwal demonstrasi yang tersedia.
const demonstrationQueues = [
  {
    id: 'queue-demo-001',
    reservationId: 'reservation-demo-001',
    queueNumber: '001',
    date: '2026-10-13',
    status: 'waiting',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

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

      const usedNumbers = repository.findAll()
        .filter((queue) => queue.date === payload.date)
        .map((queue) => Number(queue.queueNumber))
        .filter(Number.isFinite);
      const nextNumber = String(Math.max(0, ...usedNumbers) + 1).padStart(3, '0');
      const id = `queue-demo-${String(nextId).padStart(3, '0')}`;
      nextId += 1;

      return repository.create({ id, ...payload, queueNumber: nextNumber });
    },
    update(id, payload) { return repository.update(id, payload); },
  };
}

module.exports = createQueueRepository;
