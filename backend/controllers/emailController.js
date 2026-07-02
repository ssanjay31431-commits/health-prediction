const repo = require('../services/patientRepo');
const { sendPatientReportEmail, sendBulkHighRiskAlerts } = require('../services/brevoEmailService');
const { generatePatientReportPdf } = require('../services/pdfService');
const logger = require('../utils/logger');

exports.sendEmailToPatient = async (req, res, next) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });

    const patient = await repo.getById(patientId, req.adminId, req.adminRole === 'Super Admin');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    try {
      const pdfBuffer = await generatePatientReportPdf(patient);
      console.log('Patient email in emailController.sendEmailToPatient:', patient.email);
      console.log('PDF Buffer Length:', pdfBuffer?.length);
      logger.info('Sending email...');
      const result = await sendPatientReportEmail(patient, pdfBuffer);
      if (result.error) {
        logger.warn(`Patient report email failed for ${patient.email}: ${result.message}`);
        logger.error('Email send error details:', result.detail || result);
        return res.status(500).json({ message: 'Email delivery attempted but failed. Please verify Resend configuration and valid recipient addresses.', success: false, warning: result.message });
      }
      logger.info('Email sent successfully');
      return res.json({ message: 'Email delivered successfully with PDF report attached.', success: true });
    } catch (emailError) {
      logger.warn(`Patient report email failed for ${patient.email}: ${emailError.message}`);
      return res.status(500).json({ message: 'Email delivery failed, but patient record is safe.', success: false, warning: emailError.message });
    }
  } catch (err) {
    next(err);
  }
};

exports.sendEmailToAllHighRiskPatients = async (req, res, next) => {
  try {
    const result = await repo.list({
      risk: 'high',
      page: 1,
      limit: 1000,
      ownerId: req.adminId,
      isSuperAdmin: req.adminRole === 'Super Admin'
    });
    const patients = result.data || [];

    if (patients.length === 0) {
      return res.json({ message: 'No high risk patients found.', total: 0, success: 0, failed: 0, failures: [], success: true });
    }

    const summary = await sendBulkHighRiskAlerts(patients);
    return res.json({ message: 'High risk email campaign finished.', ...summary, success: true });
  } catch (err) {
    logger.error('Bulk high-risk email error', err);
    // Don't crash - return graceful response
    return res.json({ message: 'Email campaign completed with warnings.', success: true, warning: err.message });
  }
};

exports.sendTestEmail = async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient email is required in the request body as { "to": "email@example.com" }' });
    }

    logger.info('Sending email...');
    const result = await sendPatientReportEmail({
      email: to,
      remarks: { possibleCondition: 'Normal', recommendation: 'No action required.' }
    }, Buffer.from('test-pdf'));

    if (result.error) {
      logger.error(`Test email failed for ${to}: ${result.message}`);
      logger.error('Email send error details:', result.detail || result);
      return res.status(500).json({ success: false, message: 'Test email failed to send.', detail: result.message, error: result.detail || null });
    }

    logger.info('Email sent successfully');
    return res.json({ success: true, message: 'Test email sent successfully.', to, response: result.response || null });
  } catch (err) {
    logger.error('Send test email error', err);
    return res.status(500).json({ success: false, message: 'Failed to send test email.', error: err.message });
  }
};

exports.sendTestEmailPublic = async (req, res, next) => {
  try {
    const to = process.env.RESEND_OWNER_EMAIL || process.env.SUPPORT_EMAIL || 'ssanjay31431@gmail.com';

    const result = await sendPatientReportEmail({
      email: to,
      remarks: { possibleCondition: 'Normal', recommendation: 'No action required.' }
    }, Buffer.from('test-pdf'));

    console.log('Brevo public test response:', result.response || result);

    if (result.error) {
      console.error('Brevo public test error:', result.detail || result.message || result);
      return res.status(500).json({ success: false, error: result.message || String(result.detail || result) });
    }

    return res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err) {
    console.error('Send public test email exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
