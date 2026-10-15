const createInMemoryRepository = require('./inMemoryRepository');

// Reservasi ini demonstrasi dan merepresentasikan satu booking awal pada jadwal terkait.
const demonstrationReservations = [
  {
    id: 'reservation-demo-001',
    patientId: 'patient-demo-001',
    serviceId: 'service-001',
    doctorId: 'doctor-demo-001',
    scheduleId: 'schedule-demo-001',
    visitType: 'baru',
    status: 'confirmed',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

function createReservationRepository() {
  const repository = createInMemoryRepository(demonstrationReservations);
  let nextId = demonstrationReservations.length + 1;

  return {
    findAll() { return repository.findAll(); },
    findById(id) { return repository.findById(id); },
    create(payload) {
      const id = `reservation-demo-${String(nextId).padStart(3, '0')}`;
      nextId += 1;
      return repository.create({ id, ...payload });
    },
  };
}

module.exports = createReservationRepository;
