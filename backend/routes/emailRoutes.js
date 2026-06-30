const express = require('express');
const router = express.Router();
const controller = require('../controllers/emailController');

router.post('/send', controller.sendEmailToPatient);
router.post('/send-high-risk', controller.sendEmailToAllHighRiskPatients);
router.post('/test', controller.sendTestEmail);

module.exports = router;
