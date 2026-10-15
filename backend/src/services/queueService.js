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

function createQueueService({ queues, reservations, schedules }) {
  return {
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
        date: schedule.date,
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

      return queues.update(id, { status: nextStatus });
    },
  };
}

module.exports = createQueueService;
