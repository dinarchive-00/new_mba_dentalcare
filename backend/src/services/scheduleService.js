const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_QUERY_PARAMS = new Set(['doctorId', 'date']);
const SHIFT_HOURS = {
  pagi: { startTime: '09:00', endTime: '10:00' },
  siang: { startTime: '13:00', endTime: '14:00' },
};

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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

function isValidDate(date) {
  if (!DATE_PATTERN.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateQuery(query, { requireDoctorAndDate = false } = {}) {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) throw createError(`Parameter query tidak dikenal: ${key}.`);
  }
  for (const key of ALLOWED_QUERY_PARAMS) {
    const value = query[key];
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
      throw createError(`Parameter ${key} harus berupa teks yang tidak kosong.`);
    }
  }
  if (requireDoctorAndDate && (!query.doctorId || !query.date)) {
    throw createError('Parameter doctorId dan date wajib diisi.');
  }
  if (query.date !== undefined && !isValidDate(query.date)) throw createError('Tanggal tidak valid.');
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
      if (!schedule) throw createError('Data tidak ditemukan.', 404);
      return schedule;
    },
    async create(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createError('Body harus berupa objek JSON.');
      }
      const { doctorId, date, shift } = payload;
      if (typeof doctorId !== 'string' || !doctorId.trim()) throw createError('Pilih dokter terlebih dahulu.');
      if (typeof date !== 'string' || !isValidDate(date)) throw createError('Tanggal jadwal tidak valid.');
      if (!Object.hasOwn(SHIFT_HOURS, shift)) throw createError('Shift harus Pagi atau Siang.');

      const firstDate = clinicToday();
      const lastDate = addCalendarDays(firstDate, 13);
      if (date < firstDate || date > lastDate) {
        throw createError(`Tanggal jadwal harus antara ${firstDate} dan ${lastDate}.`);
      }
      const doctor = await doctors.findById(doctorId.trim());
      if (!doctor || !doctor.isActive) throw createError('Dokter tidak ditemukan atau tidak aktif.', 404);

      const existingSchedules = await repository.findAll();
      if (existingSchedules.some((schedule) => (
        schedule.doctorId === doctor.id && schedule.date === date && schedule.shift === shift
      ))) {
        throw createError('Jadwal dokter untuk tanggal dan shift tersebut sudah tersedia.', 409);
      }

      return repository.create({
        doctorId: doctor.id,
        date,
        shift,
        ...SHIFT_HOURS[shift],
        capacity: 4,
        bookedCount: 0,
        isActive: true,
      });
    },
    async availability(query = {}) {
      validateQuery(query, { requireDoctorAndDate: true });
      const today = clinicToday();
      const lastBookableDate = addCalendarDays(today, 6);
      if (query.date < today || query.date > lastBookableDate) return [];
      const schedules = await repository.findAll();
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
