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

function createReservationService({ reservations, patients, services, doctors, schedules, queues }) {
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
      if (input.visitType === 'kontrol') {
        const previousReservation = reservations.findAll()
          .filter((reservation) => reservation.patientId === input.patientId)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
        if (!previousReservation) throw createNotFoundError('Riwayat perawatan');
        if (previousReservation.doctorId !== input.doctorId) {
          throw createConflictError('Reservasi kontrol harus menggunakan dokter dari perawatan sebelumnya. Hubungi Frontline jika perlu pergantian dokter.');
        }
      }
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
      if (typeof schedule.shift !== 'string' || schedule.shift.trim() === '') {
        throw createValidationError('Shift jadwal belum tersedia. Silakan pilih jadwal lain.');
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

      let reservation;
      let queue;
      try {
        reservation = reservations.create({
          ...input,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        });
        queue = queues.createForReservation({
          reservationId: reservation.id,
          doctorId: doctor.id,
          date: schedule.date,
          shift: schedule.shift,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        });
        reservation = reservations.update(reservation.id, { queueNumber: queue.queueNumber });
      } catch (error) {
        if (queue) queues.remove(queue.id);
        if (reservation) reservations.remove(reservation.id);
        schedules.releaseBooking(input.scheduleId);
        throw error;
      }

      return {
        ...reservation,
        queue: {
          id: queue.id,
          queueNumber: queue.queueNumber,
          doctorId: doctor.id,
          date: schedule.date,
          shift: schedule.shift,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        doctorName: doctor.name,
        serviceName: service.name,
      };
    },
  };
}

module.exports = createReservationService;

