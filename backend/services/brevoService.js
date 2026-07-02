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

function formatKeyPrefix(key) {
  if (!key || typeof key !== 'string') return 'N/A';
  if (key.startsWith('xkeysib-')) return `${key.slice(0, 9)}***`;
  return `${key.slice(0, 4)}***`;
}

let brevoApiInstance = null;
let brevoConfigured = false;

const brevoApiKeyLoaded = Boolean(BREVO_API_KEY);
const brevoApiKeyValid = brevoApiKeyLoaded && BREVO_API_KEY.startsWith('xkeysib-');

console.log('================================');
console.log('Brevo Configuration');
console.log(`BREVO_API_KEY Loaded: ${brevoApiKeyLoaded ? 'YES' : 'NO'}`);
console.log(`Key Prefix: ${brevoApiKeyLoaded ? formatKeyPrefix(BREVO_API_KEY) : 'N/A'}`);
console.log(`BREVO_FROM_EMAIL: ${BREVO_FROM_EMAIL || 'Not configured'}`);
console.log('================================');

if (brevoApiKeyLoaded && brevoApiKeyValid) {
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
  logger.warn('BREVO_API_KEY is missing or invalid. Patient emails will not be delivered.');
}

function buildPatientNotificationHtml(patient) {
  const condition = patient?.remarks?.possibleCondition || 'Not available';
  const recommendation = patient?.remarks?.recommendation || 'No recommendation available.';
  const isHighRisk = /high/i.test(condition);

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">🏥 Health Prediction System</h2>
        <p style="margin: 6px 0 0; opacity: 0.9;">Your patient report is ready</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p>Dear <strong>${patient?.name || 'Patient'}</strong>,</p>
        <p>Your health prediction has been completed successfully.</p>
        <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px;"><strong>Prediction:</strong> ${condition}</p>
          <p style="margin: 0;"><strong>Recommendation:</strong> ${recommendation}</p>
        </div>
        <p>Please review the attached PDF report for full details.</p>
        ${isHighRisk ? '<p style="color: #b91c1c; font-weight: 600;">If your result indicates High Risk, we strongly recommend consulting a qualified healthcare professional as soon as possible.</p>' : ''}
        <p style="margin-top: 18px;">Thank you,<br />${BREVO_FROM_NAME}</p>
      </div>
    </div>
  `;
}

function buildPatientReportHtml(patient, filename) {
  const condition = patient?.remarks?.possibleCondition || 'Not available';
  const isHighRisk = /high/i.test(condition);

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">🏥 Health Prediction Report</h2>
        <p style="margin: 6px 0 0; opacity: 0.9;">Your PDF report is attached below</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p>Dear <strong>${patient?.name || 'Patient'}</strong>,</p>
        <p>Thank you for using the Health Prediction System.</p>
        <p>Your health assessment has been completed successfully.</p>
        <p>Please find your Health Prediction Report attached as a PDF.</p>
        <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0;"><strong>Attachment:</strong> ${filename}</p>
        </div>
        ${isHighRisk ? '<p style="color: #b91c1c; font-weight: 600;">If your result indicates High Risk, we strongly recommend consulting a qualified healthcare professional as soon as possible.</p>' : ''}
        <p style="margin-top: 18px;">Thank you,<br />${BREVO_FROM_NAME}</p>
      </div>
    </div>
  `;
}

function buildHighRiskHtml(patient) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">⚠️ High Risk Alert</h2>
        <p style="margin: 6px 0 0; opacity: 0.9;">Immediate medical consultation is recommended</p>
      </div>
      <div style="padding: 24px; border: 1px solid #fecaca; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p>Dear <strong>${patient?.name || 'Patient'}</strong>,</p>
        <p>Our Health Prediction System has identified your result as <strong>High Risk</strong>.</p>
        <p>We strongly recommend that you consult a qualified doctor as soon as possible for a medical evaluation.</p>
        <p>Please do not ignore this alert.</p>
        <p style="margin-top: 18px;">Stay safe,<br />${BREVO_FROM_NAME}</p>
      </div>
    </div>
  `;
}

function buildTextContent(patient, subjectType) {
  const name = patient?.name || 'Patient';
  switch (subjectType) {
    case 'report':
      return `Dear ${name},\n\nThank you for using the Health Prediction System.\n\nYour health assessment has been completed successfully.\n\nPlease find your Health Prediction Report attached as a PDF.\n\nIf your result indicates High Risk, we strongly recommend consulting a qualified healthcare professional as soon as possible.\n\nThank you.\n\n${BREVO_FROM_NAME}`;
    case 'high-risk':
      return `Dear ${name},\n\nOur Health Prediction System has identified your result as HIGH RISK.\n\nWe strongly recommend that you consult a qualified doctor as soon as possible for a medical evaluation.\n\nPlease do not ignore this alert.\n\nStay safe.\n\n${BREVO_FROM_NAME}`;
    default:
      return `Dear ${name},\n\nYour health prediction has been completed successfully.\n\nThank you.\n\n${BREVO_FROM_NAME}`;
  }
}

async function sendBrevoEmail({ to, subject, html, text, attachments = [] }) {
  if (!to) {
    return { error: true, message: 'Recipient email not available' };
  }

  if (!brevoConfigured || !brevoApiInstance) {
    const message = 'Brevo is not configured. Email will not be delivered.';
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
    htmlContent: html,
    textContent: text
  };

  if (attachments.length) {
    payload.attachment = attachments.map((attachment) => ({
      content: attachment.content,
      name: attachment.filename || attachment.name || 'attachment'
    }));
  }

  console.log('========== BREVO ==========');
  console.log('Recipient:', to);
  console.log('Subject:', subject);
  console.log('Attachment:', attachments.length ? attachments.map((item) => item.filename || item.name).join(', ') : 'None');
  console.log('===========================');
  logger.info(`Preparing Brevo email to ${to} with subject "${subject}"`);

  try {
    const response = await brevoApiInstance.sendTransacEmail(payload);
    const messageId = response?.body?.messageId || response?.messageId || response?.body?.id;

    if (messageId) {
      console.log('========== BREVO ==========');
      console.log('Recipient:', to);
      console.log('Subject:', subject);
      console.log('Attachment:', attachments.length ? attachments.map((item) => item.filename || item.name).join(', ') : 'None');
      console.log('Message ID:', messageId);
      console.log('Status: SUCCESS');
      console.log('===========================');
      logger.info(`Brevo email delivered successfully to ${to}; messageId=${messageId}`);
    } else {
      logger.warn(`Brevo responded without a messageId for ${to}`);
    }

    return { ok: true, provider: 'brevo', response, messageId };
  } catch (error) {
    const status = error?.response?.status;
    const responseBody = error?.response?.body;

    console.error('========== BREVO ERROR ==========');
    console.error('Recipient:', to);
    console.error('Subject:', subject);
    console.error('HTTP Status:', status || 'N/A');
    console.error('Response Body:', responseBody || 'N/A');
    console.error('Brevo Error:', error?.message || error);
    console.error('Stack Trace:', error?.stack || 'N/A');
    console.error('===========================');

    logger.error(`Brevo delivery failed for ${to}: ${error?.message || error}`);
    logger.error('Brevo response body', responseBody);
    logger.error('Brevo error details', error);

    return {
      error: true,
      message: error?.message || 'Brevo delivery failed',
      detail: error,
      status,
      responseBody
    };
  }
}

async function sendPatientNotification(patient) {
  if (!patient || !patient.email) {
    return { error: true, message: 'Patient email not available' };
  }

  const html = buildPatientNotificationHtml(patient);
  const text = buildTextContent(patient, 'notification');

  return sendBrevoEmail({
    to: patient.email,
    subject: 'Health Prediction Completed',
    html,
    text
  });
}

async function sendPatientReport(patient, pdfBuffer) {
  if (!patient || !patient.email) {
    return { error: true, message: 'Patient email not available' };
  }

  if (!pdfBuffer || !pdfBuffer.length) {
    return { error: true, message: 'PDF Buffer is invalid or empty. Aborting patient email delivery.' };
  }

  const filename = `Health_Report_${(patient.name || 'Patient').replace(/\s+/g, '_')}.pdf`;
  const html = buildPatientReportHtml(patient, filename);
  const text = buildTextContent(patient, 'report');

  return sendBrevoEmail({
    to: patient.email,
    subject: 'Your Health Prediction Report',
    html,
    text,
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
    return { error: true, message: 'Patient email not available' };
  }

  return sendBrevoEmail({
    to: patient.email,
    subject: 'Urgent Health Alert',
    html: buildHighRiskHtml(patient),
    text: buildTextContent(patient, 'high-risk')
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
  sendPatientNotification,
  sendPatientReport,
  sendHighRiskAlert,
  sendBulkHighRiskAlerts
};
