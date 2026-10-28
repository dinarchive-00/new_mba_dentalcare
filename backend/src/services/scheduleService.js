const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_QUERY_PARAMS = new Set(['doctorId', 'date']);

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateQuery(query, { requireDoctorAndDate = false } = {}) {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) {
      throw createValidationError(`Parameter query tidak dikenal: ${key}.`);
    }
  }

  for (const key of ALLOWED_QUERY_PARAMS) {
    const value = query[key];
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
      throw createValidationError(`Parameter ${key} harus berupa teks yang tidak kosong.`);
    }
  }

  if (requireDoctorAndDate && (!query.doctorId || !query.date)) {
    throw createValidationError('Parameter doctorId dan date wajib diisi.');
  }

  if (query.date !== undefined) {
    if (!DATE_PATTERN.test(query.date)) {
      throw createValidationError('Format date harus YYYY-MM-DD.');
    }
    const parsedDate = new Date(`${query.date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== query.date) {
      throw createValidationError('Tanggal tidak valid.');
    }
  }
}

function createScheduleService(repository, doctors) {
  return {
    async list(query = {}) {
      validateQuery(query);
      const schedules = await repository.findAll();
      return schedules.filter((schedule) => (
        (!query.doctorId || schedule.doctorId === query.doctorId)
        && (!query.date || schedule.date === query.date)
      ));
    },
    async getById(id) {
      const schedule = await repository.findById(id);
      if (!schedule) {
        const error = new Error('Data tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      return schedule;
    },
    async availability(query = {}) {
      validateQuery(query, { requireDoctorAndDate: true });
      let schedules = await repository.findAll();
      const doctor = doctors.findById(query.doctorId);
      const hasSchedulesForDate = schedules.some((schedule) => (
        schedule.doctorId === query.doctorId && schedule.date === query.date
      ));

      // Seed slot demonstrasi untuk tanggal yang belum memiliki jadwal.
      // Record disimpan di repository agar reservasi dapat mengunci kapasitasnya.
      if (doctor?.isActive && !hasSchedulesForDate) {
        [
          ['09:00', '10:00', 'pagi'],
          ['10:00', '11:00', 'pagi'],
          ['13:00', '14:00', 'siang'],
        ].forEach(([startTime, endTime, shift]) => repository.create({
          doctorId: query.doctorId,
          date: query.date,
          shift,
          startTime,
          endTime,
          capacity: 4,
          bookedCount: 0,
          isActive: true,
        }));
        schedules = await repository.findAll();
      }

      return schedules.filter((schedule) => (
        schedule.doctorId === query.doctorId
        && schedule.date === query.date
        && schedule.isActive
        && schedule.bookedCount < schedule.capacity
      ));
    },
  };
}

module.exports = createScheduleService;
