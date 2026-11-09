const createInMemoryRepository = require('./inMemoryRepository');

// Reservasi ini demonstrasi dan merepresentasikan satu booking awal pada jadwal terkait.
const demonstrationReservations = [];

function createReservationRepository() {
  const repository = createInMemoryRepository(demonstrationReservations);
  let nextId = demonstrationReservations.length + 1;

  return {
    findAll() { return repository.findAll(); },
    findById(id) { return repository.findById(id); },
    update(id, payload) { return repository.update(id, payload); },
    remove(id) { return repository.remove(id); },
    create(payload) {
      const id = `reservation-demo-${String(nextId).padStart(3, '0')}`;
      nextId += 1;
      return repository.create({ id, ...payload });
    },
  };
}

module.exports = createReservationRepository;
