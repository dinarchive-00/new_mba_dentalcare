const express = require('express');
const createReservationController = require('../controllers/reservationController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createReservationController(resourceServices.reservations);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);

module.exports = router;
