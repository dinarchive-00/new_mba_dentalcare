function createPatientController(service) {
  return {
    async list(req, res, next) {
      try { res.status(200).json({ data: await service.list() }); } catch (error) { next(error); }
    },
    async getById(req, res, next) {
      try { res.status(200).json({ data: await service.getById(req.params.id) }); } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try { res.status(201).json({ data: await service.create(req.body) }); } catch (error) { next(error); }
    },
  };
}

module.exports = createPatientController;
