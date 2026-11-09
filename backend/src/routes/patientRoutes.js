const express = require('express');
const requireFrontline = require('../middleware/requireFrontline');
const createPatientController = require('../controllers/patientController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createPatientController(resourceServices.patients);

router.get('/', requireFrontline, controller.list);
router.post('/identify', controller.identify);
router.post('/lookup-control', controller.findForControl);
router.post('/', controller.create);
router.get('/:id', requireFrontline, controller.getById);

module.exports = router;
