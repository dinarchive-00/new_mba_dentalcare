const VISIT_TYPES = new Set(['baru', 'kontrol']);

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function createNotFoundError(entity) {
  const error = new Error(`${entity} tidak ditemukan.`);
  error.status = 404;
  return error;
}

function createConflictError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function createReservationService({ reservations, patients, services, doctors, schedules }) {
  return {
    list() { return reservations.findAll(); },
    getById(id) {
      const reservation = reservations.findById(id);
      if (!reservation) throw createNotFoundError('Data');
      return reservation;
    },
    create(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createValidationError('Body harus berupa objek JSON.');
      }

      const requiredFields = ['patientId', 'serviceId', 'doctorId', 'scheduleId', 'visitType'];
      for (const field of requiredFields) {
        if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
          throw createValidationError(`Field ${field} wajib diisi sebagai teks.`);
        }
      }

      const input = Object.fromEntries(requiredFields.map((field) => [field, payload[field].trim()]));
      if (!VISIT_TYPES.has(input.visitType)) {
        throw createValidationError('visitType harus bernilai "baru" atau "kontrol".');
      }

      if (!patients.findById(input.patientId)) throw createNotFoundError('Pasien');
      const service = services.findById(input.serviceId);
      if (!service) throw createNotFoundError('Layanan');
      if (service.isActive === false) throw createConflictError('Layanan tidak aktif.');
      const doctor = doctors.findById(input.doctorId);
      if (!doctor) throw createNotFoundError('Dokter');
      if (!doctor.isActive) throw createConflictError('Dokter tidak aktif.');
      const schedule = schedules.findById(input.scheduleId);
      if (!schedule) throw createNotFoundError('Jadwal');
      if (schedule.doctorId !== input.doctorId) {
        throw createValidationError('Dokter tidak sesuai dengan dokter pada jadwal.');
      }
      if (!schedule.isActive) throw createConflictError('Jadwal tidak aktif.');
      if (schedule.bookedCount >= schedule.capacity) throw createConflictError('Jadwal sudah penuh.');

      // Bagian commit ini sinkron tanpa await: dalam satu proses Node, request lain tidak
      // dapat masuk di antara cek kapasitas, menaikkan bookedCount, dan menyimpan reservasi.
      const booking = schedules.tryBook(input.scheduleId, input.doctorId);
      if (booking.outcome === 'not-found') throw createNotFoundError('Jadwal');
      if (booking.outcome === 'doctor-mismatch') {
        throw createValidationError('Dokter tidak sesuai dengan dokter pada jadwal.');
      }
      if (booking.outcome === 'inactive') throw createConflictError('Jadwal tidak aktif.');
      if (booking.outcome === 'full') throw createConflictError('Jadwal sudah penuh.');

      try {
        return reservations.create({
          ...input,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        schedules.releaseBooking(input.scheduleId);
        throw error;
      }
    },
  };
}

module.exports = createReservationService;

