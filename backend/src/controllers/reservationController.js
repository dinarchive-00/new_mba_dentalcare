function createReservationController(service) {
  return {
    list(req, res, next) {
      try { res.status(200).json({ data: service.list() }); } catch (error) { next(error); }
    },
    getById(req, res, next) {
      try { res.status(200).json({ data: service.getById(req.params.id) }); } catch (error) { next(error); }
    },
    create(req, res, next) {
      try { res.status(201).json({ data: service.create(req.body) }); } catch (error) { next(error); }
    },
  };
}

module.exports = createReservationController;
