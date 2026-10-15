const createInMemoryRepository = require('./inMemoryRepository');

// Seluruh identitas berikut sintetis untuk demonstrasi, bukan data pasien nyata.
const demonstrationPatients = [
  {
    id: 'patient-demo-001',
    nik: '0000000000000001',
    name: 'Pasien Demonstrasi 1',
    phone: '080000000001',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'patient-demo-002',
    nik: '0000000000000002',
    name: 'Pasien Demonstrasi 2',
    phone: '080000000002',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

function createPatientRepository() {
  const repository = createInMemoryRepository(demonstrationPatients);
  let nextId = demonstrationPatients.length + 1;

  return {
    findAll() { return repository.findAll(); },
    findById(id) { return repository.findById(id); },
    findByNik(nik) { return repository.findAll().find((patient) => patient.nik === nik) || null; },
    create(payload) {
      const id = `patient-demo-${String(nextId).padStart(3, '0')}`;
      nextId += 1;
      return repository.create({ id, ...payload });
    },
  };
}

module.exports = createPatientRepository;
