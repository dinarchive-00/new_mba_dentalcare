const express = require('express');
const requireFrontline = require('../middleware/requireFrontline');
const createQueueController = require('../controllers/queueController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createQueueController(resourceServices.queues);

router.use(requireFrontline);

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.get('/:id', controller.getById);

module.exports = router;
