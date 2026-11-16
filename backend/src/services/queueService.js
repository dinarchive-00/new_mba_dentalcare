const QUEUE_STATUSES = new Set(['waiting', 'called', 'in_progress', 'completed', 'cancelled']);
const STATUS_TRANSITIONS = {
  waiting: new Set(['called', 'cancelled']),
  called: new Set(['in_progress', 'cancelled']),
  in_progress: new Set(['completed']),
  completed: new Set(),
  cancelled: new Set(),
};
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateDate(date) {
  if (!DATE_PATTERN.test(date)) throw createError('Format date harus YYYY-MM-DD.', 400);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw createError('Tanggal tidak valid.', 400);
  }
}

function clinicToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function validateFilters(filters) {
  for (const key of Object.keys(filters)) {
    if (key !== 'date' && key !== 'status') {
      throw createError(`Parameter query tidak dikenal: ${key}.`, 400);
    }
  }
  for (const key of ['date', 'status']) {
    const value = filters[key];
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
      throw createError(`Parameter ${key} harus berupa teks yang tidak kosong.`, 400);
    }
  }
  if (filters.date !== undefined) validateDate(filters.date);
  if (filters.status !== undefined && !QUEUE_STATUSES.has(filters.status)) {
    throw createError('Status antrean tidak valid.', 400);
  }
}

function validateCurrentFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw createError('Parameter dokter dan tanggal wajib diisi.', 400);
  }
  for (const key of Object.keys(filters)) {
    if (key !== 'doctorId' && key !== 'date') throw createError(`Parameter query tidak dikenal: ${key}.`, 400);
  }
  if (typeof filters.doctorId !== 'string' || !filters.doctorId.trim()) {
    throw createError('Parameter doctorId wajib diisi.', 400);
  }
  if (typeof filters.date !== 'string' || !filters.date.trim()) {
    throw createError('Parameter date wajib diisi.', 400);
  }
  validateDate(filters.date);
}

function createQueueService({ queues, reservations, schedules, doctors }) {
  return {
    current(filters = {}) {
      validateCurrentFilters(filters);
      const doctorId = filters.doctorId.trim();
      if (!doctors.findById(doctorId)) throw createError('Dokter tidak ditemukan.', 404);
      return queues.findAll()
        .filter((queue) => (
          queue.doctorId === doctorId
          && queue.date === filters.date
          && queue.status === 'in_progress'
        ))
        .map((queue) => queue.queueNumber)
        .filter((queueNumber) => typeof queueNumber === 'string' || Number.isFinite(queueNumber))
        .sort((a, b) => Number(a) - Number(b));
    },
    listRegistered() {
      const firstDate = clinicToday();
      const lastDate = addCalendarDays(firstDate, 6);
      const activeSchedules = schedules.findAll().filter((schedule) => (
        schedule.isActive && schedule.date >= firstDate && schedule.date <= lastDate
      ));
      const doctorsById = new Map(doctors.findAll().map((doctor) => [doctor.id, doctor]));
      const groups = new Map();
      activeSchedules.forEach((schedule) => {
        const doctor = doctorsById.get(schedule.doctorId);
        if (!doctor || !doctor.isActive) return;
        const key = `${schedule.doctorId}:${schedule.date}`;
        if (!groups.has(key)) {
          groups.set(key, {
            doctorId: doctor.id,
            doctorName: doctor.name,
            date: schedule.date,
            registeredCount: 0,
          });
        }
      });
      queues.findAll().forEach((queue) => {
        if (queue.status === 'cancelled' || queue.date < firstDate || queue.date > lastDate) return;
        const reservation = reservations.findById(queue.reservationId);
        if (!reservation || reservation.status === 'cancelled') return;
        const key = `${queue.doctorId}:${queue.date}`;
        const group = groups.get(key);
        if (group) group.registeredCount += 1;
      });
      return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.doctorName.localeCompare(b.doctorName, 'id'));
    },
    list(filters = {}) {
      validateFilters(filters);
      return queues.findAll().filter((queue) => (
        (filters.date === undefined || queue.date === filters.date)
        && (filters.status === undefined || queue.status === filters.status)
      ));
    },
    getById(id) {
      const queue = queues.findById(id);
      if (!queue) throw createError('Data tidak ditemukan.', 404);
      return queue;
    },
    create(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createError('Body harus berupa objek JSON.', 400);
      }
      if (typeof payload.reservationId !== 'string' || payload.reservationId.trim() === '') {
        throw createError('Field reservationId wajib diisi sebagai teks.', 400);
      }

      const reservationId = payload.reservationId.trim();
      const reservation = reservations.findById(reservationId);
      if (!reservation) throw createError('Reservasi tidak ditemukan.', 404);
      if (reservation.status === 'cancelled') {
        throw createError('Reservasi yang dibatalkan tidak dapat dibuatkan antrean.', 409);
      }
      if (reservation.status !== 'confirmed') {
        throw createError('Reservasi belum terkonfirmasi.', 409);
      }
      if (queues.findByReservationId(reservationId)) {
        throw createError('Reservasi sudah memiliki antrean.', 409);
      }

      const schedule = schedules.findById(reservation.scheduleId);
      if (!schedule) throw createError('Jadwal reservasi tidak ditemukan.', 404);

      // Tanggal dan nomor antrean ditentukan dari repository, bukan dari request.
      return queues.createForReservation({
        reservationId,
        doctorId: reservation.doctorId,
        date: schedule.date,
        shift: schedule.shift,
        status: 'waiting',
        createdAt: new Date().toISOString(),
      });
    },
    updateStatus(id, nextStatus) {
      if (typeof nextStatus !== 'string' || !QUEUE_STATUSES.has(nextStatus)) {
        throw createError('Status antrean tidak valid.', 400);
      }

      const queue = queues.findById(id);
      if (!queue) throw createError('Data tidak ditemukan.', 404);
      if (!STATUS_TRANSITIONS[queue.status].has(nextStatus)) {
        throw createError(`Transisi status ${queue.status} ke ${nextStatus} tidak diizinkan.`, 400);
      }

      const updatedQueue = queues.update(id, { status: nextStatus });
      const reservation = reservations.findById(queue.reservationId);
      if (reservation) {
        reservations.update(reservation.id, { status: nextStatus });
        if (nextStatus === 'cancelled') schedules.releaseBooking(reservation.scheduleId);
      }
      return updatedQueue;
    },
  };
}

module.exports = createQueueService;
