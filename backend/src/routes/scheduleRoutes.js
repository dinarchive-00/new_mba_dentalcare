const express = require('express');
const requireFrontline = require('../middleware/requireFrontline');
const createScheduleController = require('../controllers/scheduleController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createScheduleController(resourceServices.schedules);

// Rute statis harus lebih dahulu agar tidak dianggap sebagai ID jadwal.
router.get('/availability', controller.availability);
router.get('/', controller.list);
router.post('/', requireFrontline, controller.create);
router.get('/:id', controller.getById);

module.exports = router;
