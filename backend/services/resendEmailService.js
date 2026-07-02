const { Resend } = require('resend');
const logger = require('../utils/logger');

const {
  RESEND_API_KEY: RESEND_API_KEY_RAW,
  RESEND_FROM_EMAIL: RESEND_FROM_EMAIL_RAW,
  SUPPORT_EMAIL: SUPPORT_EMAIL_ENV,
  RESEND_OWNER_EMAIL: RESEND_OWNER_EMAIL_ENV
} = process.env;

const RESEND_API_KEY = RESEND_API_KEY_RAW?.trim();
const RESEND_FROM_EMAIL = RESEND_FROM_EMAIL_RAW?.trim();
const SUPPORT_EMAIL = SUPPORT_EMAIL_ENV?.trim();
const RESEND_OWNER_EMAIL = RESEND_OWNER_EMAIL_ENV?.trim();
const adminRecipient = RESEND_OWNER_EMAIL || SUPPORT_EMAIL || 'ssanjay31431@gmail.com';
const resendOwnerEmail = RESEND_OWNER_EMAIL || '';

const resendFromAddress = RESEND_FROM_EMAIL || 'Health Prediction <onboarding@resend.dev>';
const resendTestMode = resendFromAddress.toLowerCase().includes('onboarding@resend.dev');

function formatKeyPrefix(key) {
  if (!key || typeof key !== 'string') return 'N/A';
  const prefix = key.startsWith('re_') ? key.slice(0, 7) : key.slice(0, 4);
  return `${prefix}***`;
}

const resendApiKeyLoaded = Boolean(RESEND_API_KEY);
const resendApiKeyValid = resendApiKeyLoaded && RESEND_API_KEY.startsWith('re_');

console.log('================================');
console.log('Resend Configuration');
console.log(`RESEND_API_KEY Loaded: ${resendApiKeyLoaded ? 'YES' : 'NO'}`);
console.log(`Key Prefix: ${resendApiKeyLoaded ? formatKeyPrefix(RESEND_API_KEY) : 'N/A'}`);
console.log(`RESEND_FROM_EMAIL: ${resendFromAddress}`);
console.log(`Resend Test Mode: ${resendTestMode ? 'YES' : 'NO'}`);
console.log('================================');

if (!resendApiKeyValid) {
  throw new Error('RESEND_API_KEY is missing or invalid.');
}

if (resendTestMode && !resendOwnerEmail) {
  console.warn('Resend is running in test mode with onboarding@resend.dev and RESEND_OWNER_EMAIL is not set. Delivery will be blocked for non-owner recipients.');
}

const resendClient = new Resend(RESEND_API_KEY);

async function sendMail(mailOptions) {
  const options = {
    from: mailOptions.from || resendFromAddress,
    ...mailOptions
  };

  const payload = {
    from: options.from,
    to: options.to,
    subject: options.subject || 'No subject',
    html: options.html,
    text: options.text
  };

  if (options.attachments?.length) {
    payload.attachments = options.attachments.map((attachment) => ({
      name: attachment.filename || attachment.name,
      type: attachment.contentType || attachment.type || 'application/pdf',
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content || '').toString('base64')
    }));
  }

  if (resendTestMode && options.to && options.to.toString().trim().toLowerCase() !== (adminRecipient || '').toString().trim().toLowerCase()) {
    const message = `Resend is running in test mode with from ${resendFromAddress}. It can only deliver to the verified owner email ${adminRecipient}. Please set RESEND_OWNER_EMAIL to a verified Resend address or update RESEND_FROM_EMAIL to a verified custom domain before sending to other recipients.`;
    logger.error(message);
    return { error: true, message, detail: { type: 'resend_test_mode', from: resendFromAddress, to: options.to, owner: adminRecipient } };
  }

  console.log('=== RESEND REQUEST ===');
  console.log('Recipient:', options.to);
  console.log('From:', options.from);
  console.log('Subject:', payload.subject);
  console.log('Attachment Count:', payload.attachments?.length || 0);
  console.log('======================');

  try {
    const response = await resendClient.emails.send(payload);
    if (response?.error) {
      throw new Error(response.error.message || 'Resend returned an error');
    }

    const messageId = response?.data?.id;
    if (!messageId) {
      throw new Error('Resend response missing data.id');
    }

    console.log('Resend Message ID:', messageId);
    logger.info(`Resend email delivered to ${options.to}; messageId=${messageId}`);
    return { ok: true, provider: 'resend', response, messageId };
  } catch (error) {
    console.error('Resend delivery failed:', error?.message || error);
    logger.error('Resend delivery failed:', error);
    logger.error('Resend payload:', payload);
    return { error: true, message: error?.message || 'Resend delivery failed', detail: error };
  }
}

function buildAdminAccountRequestBody(request) {
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
  const approveLink = `${backendUrl}/api/pending-requests/${request._id}/approve`;
  const rejectLink = `${backendUrl}/api/pending-requests/${request._id}/reject`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #0d47a1;">🏥 Health Prediction System</h2>
        <p style="margin: 5px 0 0 0; color: #666;">New Account Request</p>
      </div>
      <p>A new account creation request has been submitted and is pending your approval.</p>
      <div style="background-color: #f9fafb; border-left: 4px solid #0d47a1; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${request.fullName}</p>
        <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${request.username}</p>
        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${request.email}</p>
        <p style="margin: 0 0 10px 0;"><strong>Mobile:</strong> ${request.mobile || 'N/A'}</p>
        <p style="margin: 0 0 10px 0;"><strong>Requested Role:</strong> ${request.role || 'Admin'}</p>
        <p style="margin: 0;"><strong>Request Type:</strong> ${request.requestType}</p>
      </div>
      <p style="margin: 20px 0;"><strong>Action Required:</strong> Please review the account request details above and take action:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${approveLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-right: 10px;">✅ Approve Account</a>
        <a href="${rejectLink}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">❌ Reject Request</a>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>Note:</strong> Clicking "Approve Account" will create the account and send a confirmation email to the requested email address.
      </p>
    </div>
  `;

  return { html: htmlBody, text: buildAdminAccountRequestBodyText(request) };
}

function buildAdminAccountRequestBodyText(request) {
  return `🏥 Health Prediction System\n\nA new account creation request has been submitted and is pending approval.\n\nName: ${request.fullName}\nUsername: ${request.username}\nEmail: ${request.email}\nMobile: ${request.mobile || 'N/A'}\nRequested Role: ${request.role}\nRequest Type: ${request.requestType}\n\nReview and approve this request in the admin panel.\n\nThank you,\nHealth Prediction System`;
}

async function sendAdminAccountRequestNotification(request) {
  const emailContent = buildAdminAccountRequestBody(request);
  const options = {
    to: adminRecipient,
    subject: `New Account Request: ${request.username}`,
    text: emailContent.text,
    html: emailContent.html
  };
  return sendMail(options);
}

function buildForgotPasswordText(admin) {
  return `🏥 Health Prediction System

Hello ${admin.fullName || admin.username},

Your password reset OTP is: ${admin.resetToken || 'N/A'}

This code expires in 30 minutes.

If you did not request this, please ignore this email.

Thank you,
Health Prediction System`;
}

function buildForgotPasswordHtml(admin) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #1d4ed8;">🔐 Password Reset OTP</h2>
      </div>
      <p>Hello <strong>${admin.fullName || admin.username}</strong>,</p>
      <p>Your password reset OTP is:</p>
      <p style="font-size: 22px; font-weight: bold; letter-spacing: 2px; background: #f8fafc; padding: 14px; border-radius: 8px; display: inline-block;">${admin.resetToken || 'N/A'}</p>
      <p style="margin-top: 18px;">This code expires in 30 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p style="margin-top: 18px;">Thank you,<br />Health Prediction System</p>
    </div>
  `;
}

async function sendForgotPasswordOTP(admin) {
  if (!admin || !admin.email) {
    return { error: true, message: 'Admin email is required to send password reset OTP.' };
  }

  const options = {
    to: admin.email,
    subject: 'Your Password Reset OTP',
    text: buildForgotPasswordText(admin),
    html: buildForgotPasswordHtml(admin)
  };

  return sendMail(options);
}

module.exports = {
  sendMail,
  sendAdminAccountRequestNotification,
  sendForgotPasswordOTP
};
