const express = require('express');
const createResourceRouter = require('./resourceRouter');
const scheduleRoutes = require('./scheduleRoutes');
const patientRoutes = require('./patientRoutes');
const reservationRoutes = require('./reservationRoutes');
const queueRoutes = require('./queueRoutes');
const { createHealthController } = require('../controllers/healthController');
const { resourceServices } = require('../services');

const router = express.Router();
const healthController = createHealthController();

router.get('/health', healthController.getHealth);
router.use('/reservations', reservationRoutes);
router.use('/services', createResourceRouter(resourceServices.services));
router.use('/doctors', createResourceRouter(resourceServices.doctors));
router.use('/schedules', scheduleRoutes);
router.use('/queues', queueRoutes);
router.use('/patients', patientRoutes);

module.exports = router;




