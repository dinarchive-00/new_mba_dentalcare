const express = require('express');
const createPatientController = require('../controllers/patientController');
const { resourceServices } = require('../services');

const router = express.Router();
const controller = createPatientController(resourceServices.patients);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);

module.exports = router;
