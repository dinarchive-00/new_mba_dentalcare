const express = require('express');
const requireFrontline = require('../middleware/requireFrontline');
const createReservationController = require('../controllers/reservationController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createReservationController(resourceServices.reservations);

router.get('/', requireFrontline, controller.list);
router.patch('/:id/status', requireFrontline, controller.updateStatus);
router.post('/', controller.create);
router.get('/:id', requireFrontline, controller.getById);

module.exports = router;
