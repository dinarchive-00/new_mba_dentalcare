function createScheduleController(service) {
  return {
    async list(req, res, next) {
      try {
        res.status(200).json({ data: await service.list(req.query) });
      } catch (error) { next(error); }
    },
    async getById(req, res, next) {
      try {
        res.status(200).json({ data: await service.getById(req.params.id) });
      } catch (error) { next(error); }
    },
    async availability(req, res, next) {
      try {
        res.status(200).json({ data: await service.availability(req.query) });
      } catch (error) { next(error); }
    },
  };
}

module.exports = createScheduleController;
