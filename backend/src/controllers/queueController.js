function createQueueController(service) {
  return {
    list(req, res, next) {
      try { res.status(200).json({ data: service.list(req.query) }); } catch (error) { next(error); }
    },
    getById(req, res, next) {
      try { res.status(200).json({ data: service.getById(req.params.id) }); } catch (error) { next(error); }
    },
    create(req, res, next) {
      try { res.status(201).json({ data: service.create(req.body) }); } catch (error) { next(error); }
    },
    updateStatus(req, res, next) {
      try { res.status(200).json({ data: service.updateStatus(req.params.id, req.body?.status) }); } catch (error) { next(error); }
    },
  };
}

module.exports = createQueueController;
