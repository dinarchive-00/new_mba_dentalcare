function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function createPatientService(repository) {
  return {
    list() { return repository.findAll(); },
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

      if (await repository.findByNik(nik)) {
        const error = new Error('NIK sudah terdaftar.');
        error.status = 409;
        throw error;
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
