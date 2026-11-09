function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function createConflictError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function normalizeName(name) {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function createPatientService(repository, { reservations, doctors } = {}) {
  function findPatientByIdentity(payload, mismatchStatus = 409) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw createValidationError('Body harus berupa objek JSON.');
    }
    const nik = typeof payload.nik === 'string' ? payload.nik.trim() : '';
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!/^\d{16}$/.test(nik) || !name) {
      throw createValidationError('NIK 16 digit dan nama lengkap wajib diisi.');
    }
    const patient = repository.findByNik(nik);
    if (!patient) return { patient: null, nik, name };
    if (normalizeName(patient.name) !== normalizeName(name)) {
      const error = new Error('NIK sudah terdaftar, tetapi nama lengkap tidak cocok. Periksa kembali nama sesuai identitas pasien.');
      error.status = mismatchStatus;
      throw error;
    }
    return { patient, nik, name };
  }

  return {
    list() { return repository.findAll(); },
    identify(payload) {
      const { patient, nik } = findPatientByIdentity(payload);
      if (!patient) return { found: false, patient: null };
      return { found: true, patient: { id: patient.id, nik, name: patient.name, phone: patient.phone } };
    },
    async findForControl(payload) {
      if (!reservations || !doctors) throw new Error('Pencarian data kontrol belum dikonfigurasi.');
      const { patient } = findPatientByIdentity(payload, 404);
      if (!patient) {
        const error = new Error('NIK atau nama lengkap tidak cocok dengan data pasien.');
        error.status = 404;
        throw error;
      }
      const previous = reservations.findAll()
        .filter((reservation) => reservation.patientId === patient.id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
      if (!previous) {
        const error = new Error('Data kunjungan sebelumnya tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      const doctor = doctors.findById(previous.doctorId);
      if (!doctor) {
        const error = new Error('Dokter dari kunjungan sebelumnya tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      return { patientId: patient.id, patientName: patient.name, patientPhone: patient.phone, doctor };
    },
    async getById(id) {
      const patient = await repository.findById(id);
      if (!patient) {
        const error = new Error('Data tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      return patient;
    },
    async create(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createValidationError('Body harus berupa objek JSON.');
      }

      const requiredFields = ['nik', 'name', 'phone'];
      for (const field of requiredFields) {
        if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
          throw createValidationError(`Field ${field} wajib diisi sebagai teks.`);
        }
      }

      const nik = payload.nik.trim();
      const name = payload.name.trim();
      const phone = payload.phone.trim();

      if (!/^\d{16}$/.test(nik)) {
        throw createValidationError('NIK harus terdiri dari 16 digit.');
      }
      // Format yang diterima: nomor seluler domestik Indonesia, 10–13 digit, diawali 08.
      if (!/^08\d{8,11}$/.test(phone)) {
        throw createValidationError('Nomor telepon harus berupa nomor seluler Indonesia yang diawali 08 dan terdiri dari 10–13 digit.');
      }

      const existingPatient = repository.findByNik(nik);
      if (existingPatient) {
        if (normalizeName(existingPatient.name) !== normalizeName(name)) {
          throw createConflictError('NIK sudah terdaftar, tetapi nama lengkap tidak cocok. Periksa kembali nama sesuai identitas pasien.');
        }
        throw createConflictError('NIK sudah terdaftar. Identifikasi pasien untuk menggunakan record yang sudah ada.');
      }

      return repository.create({
        nik,
        name,
        phone,
        createdAt: new Date().toISOString(),
      });
    },
  };
}

module.exports = createPatientService;
