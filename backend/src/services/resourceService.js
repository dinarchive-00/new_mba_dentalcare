function createResourceService(repository) {
  return {
    list() { return repository.findAll(); },
    async create(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        const error = new Error('Body harus berupa objek JSON.');
        error.status = 400;
        throw error;
      }
      return repository.create(payload);
    },
    async getById(id) {
      const record = await repository.findById(id);
      if (!record) {
        const error = new Error('Data tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      return record;
    },
    async update(id, payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        const error = new Error('Body harus berupa objek JSON.');
        error.status = 400;
        throw error;
      }
      const record = await repository.update(id, payload);
      if (!record) {
        const error = new Error('Data tidak ditemukan.');
        error.status = 404;
        throw error;
      }
      return record;
    },
    async remove(id) {
      const deleted = await repository.remove(id);
      if (!deleted) {
        const error = new Error('Data tidak ditemukan.');
        error.status = 404;
        throw error;
      }
    },
  };
}

module.exports = createResourceService;
