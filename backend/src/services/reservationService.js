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

const RESERVATION_STATUS_TRANSITIONS = {
  confirmed: new Set(['waiting', 'cancelled']),
  waiting: new Set(['called', 'cancelled']),
  called: new Set(['in_progress', 'cancelled']),
  in_progress: new Set(['completed']),
  completed: new Set(),
  cancelled: new Set(),
};

function createReservationService({ reservations, patients, services, doctors, schedules, queues }) {
  return {
    list() { return reservations.findAll(); },
    getById(id) {
      const reservation = reservations.findById(id);
      if (!reservation) throw createNotFoundError('Data');
      return reservation;
    },
    updateStatus(id, nextStatus) {
      const reservation = reservations.findById(id);
      if (!reservation) throw createNotFoundError('Reservasi');
      if (!RESERVATION_STATUS_TRANSITIONS[reservation.status]?.has(nextStatus)) {
        throw createConflictError(`Perubahan status ${reservation.status} ke ${nextStatus} tidak diizinkan.`);
      }

      const queue = queues.findByReservationId(id);
      if (!queue) throw createNotFoundError('Antrean reservasi');
      if (nextStatus === 'waiting') return reservations.update(id, { status: nextStatus });

      const queueTransitions = {
        waiting: new Set(['called', 'cancelled']),
        called: new Set(['in_progress', 'cancelled']),
        in_progress: new Set(['completed']),
      };
      if (!queueTransitions[queue.status]?.has(nextStatus)) {
        throw createConflictError(`Perubahan status antrean ${queue.status} ke ${nextStatus} tidak diizinkan.`);
      }

      queues.update(queue.id, { status: nextStatus });
      if (nextStatus === 'cancelled') schedules.releaseBooking(reservation.scheduleId);
      return reservations.update(id, { status: nextStatus });
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
      const hasAddress = typeof payload.address === 'string';
      const address = hasAddress ? payload.address.trim() : '';
      if (hasAddress && !address) throw createValidationError('Alamat wajib diisi.');
      if (address.length > 500) throw createValidationError('Alamat maksimal 500 karakter.');
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
        if (hasAddress) {
          const updatedPatient = patients.update(input.patientId, { address });
          if (!updatedPatient) throw createNotFoundError('Pasien');
        }
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

