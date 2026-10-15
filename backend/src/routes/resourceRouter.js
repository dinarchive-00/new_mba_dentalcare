const express = require('express');
const createResourceController = require('../controllers/resourceController');

function createResourceRouter(service) {
  const router = express.Router();
  const controller = createResourceController(service);

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = createResourceRouter;
