const express = require('express');
const createAuthController = require('../controllers/authController');

const router = express.Router();
const controller = createAuthController();

router.post('/frontline/login', controller.login);
router.get('/session', controller.session);
router.post('/frontline/logout', controller.logout);

module.exports = router;
