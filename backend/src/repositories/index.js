const createInMemoryRepository = require('./inMemoryRepository');
const createPatientRepository = require('./patientRepository');
const createReservationRepository = require('./reservationRepository');
const createScheduleRepository = require('./scheduleRepository');
const createQueueRepository = require('./queueRepository');

// Mock awal untuk demonstrasi API; data hanya tersimpan di memori proses.
const serviceRecords = [
  {
    id: 'service-001',
    name: 'Pemeriksaan Umum',
    description: 'Pemeriksaan gigi secara menyeluruh untuk senyum sehat.',
  },
  {
    id: 'service-002',
    name: 'Tambal Gigi',
    description: 'Perawatan untuk memperbaiki gigi berlubang agar tetap sehat.',
  },
  {
    id: 'service-003',
    name: 'Cabut Gigi',
    description: 'Tindakan untuk mengangkat gigi yang rusak dan tidak dapat dipertahankan.',
  },
  {
    id: 'service-004',
    name: 'Perawatan Ortodonti',
    description: 'Rencanakan senyum rapi bersama dokter kami.',
  },
];

// Data demonstrasi, bukan data dokter nyata.
const doctorRecords = [
  {
    id: 'doctor-demo-001',
    name: 'Dokter Demonstrasi 1',
    specialty: 'Dokter Gigi Umum',
    serviceIds: ['service-001', 'service-002'],
    isActive: true,
  },
  {
    id: 'doctor-demo-002',
    name: 'Dokter Demonstrasi 2',
    specialty: 'Dokter Gigi',
    serviceIds: ['service-003', 'service-004'],
    isActive: true,
  },
  {
    id: 'doctor-demo-003',
    name: 'Dokter Demonstrasi 3',
    specialty: 'Dokter Gigi',
    serviceIds: ['service-001'],
    isActive: false,
  },
];
// Data jadwal demonstrasi, bukan jadwal klinik yang terkonfirmasi.
const scheduleRecords = [
  {
    id: 'schedule-demo-001',
    doctorId: 'doctor-demo-001',
    date: '2026-10-13',
    shift: 'pagi',
    startTime: '09:00',
    endTime: '10:00',
    capacity: 4,
    bookedCount: 1,
    isActive: true,
  },
  {
    id: 'schedule-demo-002',
    doctorId: 'doctor-demo-001',
    date: '2026-10-13',
    shift: 'pagi',
    startTime: '10:00',
    endTime: '11:00',
    capacity: 2,
    bookedCount: 2,
    isActive: true,
  },
  {
    id: 'schedule-demo-003',
    doctorId: 'doctor-demo-001',
    date: '2026-10-13',
    shift: 'siang',
    startTime: '13:00',
    endTime: '14:00',
    capacity: 3,
    bookedCount: 0,
    isActive: false,
  },
  {
    id: 'schedule-demo-004',
    doctorId: 'doctor-demo-002',
    date: '2026-10-13',
    shift: 'pagi',
    startTime: '09:00',
    endTime: '10:00',
    capacity: 3,
    bookedCount: 0,
    isActive: true,
  },
];
const resourceRepositories = {
  reservations: createReservationRepository(),
  services: createInMemoryRepository(serviceRecords),
  doctors: createInMemoryRepository(doctorRecords),
  schedules: createScheduleRepository(scheduleRecords),
  queues: createQueueRepository(),
  patients: createPatientRepository(),
};

module.exports = { resourceRepositories };





