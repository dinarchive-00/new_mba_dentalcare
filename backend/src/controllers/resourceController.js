function createResourceController(service) {
  return {
    async list(req, res, next) {
      try {
        res.status(200).json({ data: await service.list(req.query) });
      } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try {
        const data = await service.create(req.body);
        res.status(201).json({ data });
      } catch (error) { next(error); }
    },
    async getById(req, res, next) {
      try {
        res.status(200).json({ data: await service.getById(req.params.id) });
      } catch (error) { next(error); }
    },
    async update(req, res, next) {
      try {
        res.status(200).json({ data: await service.update(req.params.id, req.body) });
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        await service.remove(req.params.id);
        res.status(204).end();
      } catch (error) { next(error); }
    },
  };
}

module.exports = createResourceController;

