const { randomUUID } = require('crypto');

function createInMemoryRepository(initialRecords = []) {
  const records = new Map(initialRecords.map((record) => [record.id, record]));

  return {
    findAll() { return Array.from(records.values()); },
    findById(id) { return records.get(id) || null; },
    create(payload) {
      const record = { id: randomUUID(), ...payload };
      records.set(record.id, record);
      return record;
    },
    update(id, payload) {
      const current = records.get(id);
      if (!current) return null;
      const record = { ...current, ...payload, id };
      records.set(id, record);
      return record;
    },
    remove(id) { return records.delete(id); },
  };
}

module.exports = createInMemoryRepository;


