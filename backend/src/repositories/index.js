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
function nextDemoScheduleDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const [year, month, day] = today.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
}

// Jadwal demonstrasi aktif mulai besok agar selalu masuk jendela pemesanan.
const demoScheduleDate = nextDemoScheduleDate();
const scheduleRecords = [
  {
    id: 'schedule-demo-001',
    doctorId: 'doctor-demo-001',
    date: demoScheduleDate,
    shift: 'pagi',
    startTime: '09:00',
    endTime: '10:00',
    capacity: 4,
    bookedCount: 0,
    isActive: true,
  },
  {
    id: 'schedule-demo-002',
    doctorId: 'doctor-demo-001',
    date: demoScheduleDate,
    shift: 'pagi',
    startTime: '10:00',
    endTime: '11:00',
    capacity: 2,
    bookedCount: 0,
    isActive: true,
  },
  {
    id: 'schedule-demo-003',
    doctorId: 'doctor-demo-001',
    date: demoScheduleDate,
    shift: 'siang',
    startTime: '13:00',
    endTime: '14:00',
    capacity: 3,
    bookedCount: 0,
    isActive: true,
  },
  {
    id: 'schedule-demo-004',
    doctorId: 'doctor-demo-002',
    date: demoScheduleDate,
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





