const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SibApiV3Sdk = require('sib-api-v3-sdk');
const logger = require('../utils/logger');

const {
  BREVO_API_KEY: BREVO_API_KEY_RAW,
  BREVO_FROM_EMAIL: BREVO_FROM_EMAIL_RAW,
  BREVO_FROM_NAME: BREVO_FROM_NAME_RAW
} = process.env;

const BREVO_API_KEY = BREVO_API_KEY_RAW?.trim();
const BREVO_FROM_EMAIL = BREVO_FROM_EMAIL_RAW?.trim();
const BREVO_FROM_NAME = BREVO_FROM_NAME_RAW?.trim() || 'Health Prediction System';

const brevoApiKeyLoaded = Boolean(BREVO_API_KEY);
const brevoApiKeyValid = brevoApiKeyLoaded && BREVO_API_KEY.startsWith('xkeysib-');

let brevoApiInstance = null;
let brevoConfigured = false;

function formatKeyPrefix(key) {
  if (!key || typeof key !== 'string') return 'N/A';
  return key.startsWith('xkeysib-') ? `${key.slice(0, 11)}***` : `${key.slice(0, 4)}***`;
}

console.log('================================');
console.log('Brevo Configuration');
console.log(`BREVO_API_KEY Loaded: ${brevoApiKeyLoaded ? 'YES' : 'NO'}`);
console.log(`Key Prefix: ${brevoApiKeyLoaded ? formatKeyPrefix(BREVO_API_KEY) : 'N/A'}`);
console.log(`BREVO_FROM_EMAIL: ${BREVO_FROM_EMAIL || 'Not configured'}`);
console.log('================================');

if (brevoApiKeyValid) {
  try {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = BREVO_API_KEY;
    brevoApiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    brevoConfigured = true;
  } catch (error) {
    logger.error('Failed to initialize Brevo SDK', error);
  }
} else {
  logger.error('BREVO_API_KEY is missing or invalid. Patient and password emails will not be delivered.');
}

function buildTextContent(patient, type) {
  const name = patient?.name || 'User';
  if (type === 'report') {
    return `Dear ${name},\n\nYour health prediction report is ready. Please find the attached PDF file.\n\nIf your result indicates High Risk, consult a qualified healthcare professional immediately.\n\nThank you,\n${BREVO_FROM_NAME}`;
  }
  if (type === 'highRisk') {
    return `Dear ${name},\n\nOur Health Prediction System has identified your result as HIGH RISK.\n\nWe strongly recommend consulting a qualified doctor as soon as possible.\n\nStay safe,\n${BREVO_FROM_NAME}`;
  }
  if (type === 'forgotPassword') {
    return `Dear ${name},\n\nYour password reset OTP is: ${patient.resetToken || 'N/A'}\n\nThis code expires in 30 minutes.\n\nIf you did not request this, please ignore this email.\n\nThank you,\n${BREVO_FROM_NAME}`;
  }
  if (type === 'resetSuccess') {
    return `Dear ${name},\n\nYour password has been reset successfully.\n\nIf you did not perform this action, please contact support immediately.\n\nThank you,\n${BREVO_FROM_NAME}`;
  }
  return `Dear ${name},\n\nThis is a message from the Health Prediction System.\n\nThank you,\n${BREVO_FROM_NAME}`;
}

function buildHtmlContent(patient, type, filename) {
  const name = patient?.name || 'User';
  if (type === 'report') {
    const condition = patient?.remarks?.possibleCondition || 'Not available';
    const recommendation = patient?.remarks?.recommendation || 'No recommendation available.';
    const isHighRisk = /high/i.test(condition);
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 24px;">🏥 Health Prediction Report</h2>
          <p style="margin: 6px 0 0; opacity: 0.9;">Your PDF report is attached below</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your health prediction has been completed successfully.</p>
          <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0;"><strong>Prediction:</strong> ${condition}</p>
            <p style="margin: 0;"><strong>Recommendation:</strong> ${recommendation}</p>
            <p style="margin: 0;"><strong>Attachment:</strong> ${filename}</p>
          </div>
          ${isHighRisk ? '<p style="color: #b91c1c; font-weight: 600;">If your result indicates High Risk, consult a qualified healthcare professional immediately.</p>' : ''}
          <p style="margin-top: 18px;">Thank you,<br />${BREVO_FROM_NAME}</p>
        </div>
      </div>
    `;
  }
  if (type === 'highRisk') {
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 24px;">⚠️ High Risk Alert</h2>
          <p style="margin: 6px 0 0; opacity: 0.9;">Immediate medical consultation is recommended</p>
        </div>
        <div style="padding: 24px; border: 1px solid #fecaca; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Our Health Prediction System has identified your result as <strong>High Risk</strong>.</p>
          <p>We strongly recommend consulting a qualified doctor as soon as possible for a medical evaluation.</p>
          <p>Please do not ignore this alert.</p>
          <p style="margin-top: 18px;">Stay safe,<br />${BREVO_FROM_NAME}</p>
        </div>
      </div>
    `;
  }
  if (type === 'forgotPassword') {
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 24px;">🔐 Password Reset OTP</h2>
          <p style="margin: 6px 0 0; opacity: 0.9;">Use the code below to reset your password.</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your password reset OTP is:</p>
          <p style="font-size: 22px; font-weight: bold; letter-spacing: 2px; background: #f8fafc; padding: 14px; border-radius: 8px; display: inline-block;">${patient.resetToken || 'N/A'}</p>
          <p style="margin-top: 18px;">This code expires in 30 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p style="margin-top: 18px;">Thank you,<br />${BREVO_FROM_NAME}</p>
        </div>
      </div>
    `;
  }
  if (type === 'resetSuccess') {
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 24px;">✅ Password Reset Successful</h2>
          <p style="margin: 6px 0 0; opacity: 0.9;">Your account password has been updated.</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your password has been reset successfully.</p>
          <p>If you did not perform this action, please contact support immediately.</p>
          <p style="margin-top: 18px;">Thank you,<br />${BREVO_FROM_NAME}</p>
        </div>
      </div>
    `;
  }
  return `<p>Dear ${name},</p><p>Thank you,</p><p>${BREVO_FROM_NAME}</p>`;
}

async function sendBrevoEmail({ to, subject, htmlContent, textContent, attachments = [] }) {
  if (!to) {
    return { error: true, message: 'Recipient email is required' };
  }

  if (!brevoConfigured || !brevoApiInstance) {
    const message = 'Brevo is not configured or failed to initialize.';
    logger.error(message);
    return { error: true, message };
  }

  const payload = {
    sender: {
      name: BREVO_FROM_NAME,
      email: BREVO_FROM_EMAIL
    },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent
  };

  if (attachments.length) {
    payload.attachment = attachments.map((attachment) => ({
      content: attachment.content,
      name: attachment.filename || attachment.name || 'attachment'
    }));
  }

  console.log('========== BREVO REQUEST ==========',);
  console.log('Recipient:', to);
  console.log('Subject:', subject);
  console.log('Attachments:', attachments.map((item) => item.filename || item.name).join(', ') || 'None');
  console.log('===================================');

  try {
    const response = await brevoApiInstance.sendTransacEmail(payload);
    const messageId = response?.body?.messageId || response?.messageId || null;
    const status = response?.status || 'unknown';

    console.log('========== BREVO RESPONSE ==========',);
    console.log('Status:', status);
    console.log('Message ID:', messageId);
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('===================================');

    if (!messageId) {
      return { error: true, message: 'Brevo response did not return a message ID', response };
    }

    return { ok: true, provider: 'brevo', response, messageId, status };
  } catch (error) {
    const status = error?.response?.status || 'unknown';
    const responseBody = error?.response?.body || error?.body || null;

    console.error('========== BREVO ERROR ==========',);
    console.error('Recipient:', to);
    console.error('Subject:', subject);
    console.error('Status:', status);
    console.error('Response Body:', responseBody);
    console.error('Error Message:', error?.message || error);
    console.error('Stack:', error?.stack || 'N/A');
    console.error('=================================' );

    logger.error('Brevo delivery failed', { to, subject, status, responseBody, error });

    return {
      error: true,
      message: error?.message || 'Brevo delivery failed',
      detail: error,
      status,
      responseBody
    };
  }
}

async function sendForgotPasswordOTP(admin) {
  if (!admin || !admin.email) {
    return { error: true, message: 'Admin email is required' };
  }

  const subject = 'Your Password Reset OTP';
  const htmlContent = buildHtmlContent(admin, 'forgotPassword');
  const textContent = buildTextContent(admin, 'forgotPassword');

  return sendBrevoEmail({
    to: admin.email,
    subject,
    htmlContent,
    textContent
  });
}

async function sendPasswordResetSuccess(admin) {
  if (!admin || !admin.email) {
    return { error: true, message: 'Admin email is required' };
  }

  const subject = 'Password Reset Successful';
  const htmlContent = buildHtmlContent(admin, 'resetSuccess');
  const textContent = buildTextContent(admin, 'resetSuccess');

  return sendBrevoEmail({
    to: admin.email,
    subject,
    htmlContent,
    textContent
  });
}

async function sendPatientNotification(patient) {
  if (!patient || !patient.email) {
    return { error: true, message: 'Patient email is required' };
  }

  return sendBrevoEmail({
    to: patient.email,
    subject: 'Health Prediction Completed',
    htmlContent: buildHtmlContent(patient, 'report'),
    textContent: buildTextContent(patient, 'report')
  });
}

async function sendPatientReportEmail(patient, pdfBuffer) {
  if (!patient || !patient.email) {
    return { error: true, message: 'Patient email is required' };
  }

  if (!pdfBuffer || !pdfBuffer.length) {
    return { error: true, message: 'PDF buffer is required' };
  }

  const filename = `Health_Report_${(patient.name || 'Patient').replace(/\s+/g, '_')}.pdf`;
  return sendBrevoEmail({
    to: patient.email,
    subject: 'Your Health Prediction Report',
    htmlContent: buildHtmlContent(patient, 'report', filename),
    textContent: buildTextContent(patient, 'report'),
    attachments: [
      {
        filename,
        content: Buffer.isBuffer(pdfBuffer) ? pdfBuffer.toString('base64') : Buffer.from(pdfBuffer).toString('base64')
      }
    ]
  });
}

async function sendHighRiskAlert(patient) {
  if (!patient || !patient.email) {
    return { error: true, message: 'Patient email is required' };
  }

  return sendBrevoEmail({
    to: patient.email,
    subject: 'Urgent Health Alert',
    htmlContent: buildHtmlContent(patient, 'highRisk'),
    textContent: buildTextContent(patient, 'highRisk')
  });
}

async function sendBulkHighRiskAlerts(patients) {
  const results = await Promise.allSettled(
    patients.map((patient) => sendHighRiskAlert(patient).then(() => ({ patient, success: true })))
  );

  const summary = {
    total: patients.length,
    success: 0,
    failed: 0,
    failures: []
  };

  results.forEach((result, index) => {
    const patient = patients[index];
    if (result.status === 'fulfilled') {
      summary.success += 1;
    } else {
      summary.failed += 1;
      summary.failures.push({
        patientId: patient?._id || patient?.id,
        email: patient?.email,
        error: result.reason?.message || 'Unknown error'
      });
      logger.warn(`Bulk Brevo email failed for ${patient?.email}: ${result.reason?.message}`);
    }
  });

  return summary;
}

module.exports = {
  sendForgotPasswordOTP,
  sendPasswordResetSuccess,
  sendPatientNotification,
  sendPatientReportEmail,
  sendPdfReport: sendPatientReportEmail,
  sendPasswordResetEmail: sendForgotPasswordOTP,
  sendHighRiskAlert,
  sendBulkHighRiskAlerts
};
