const { Resend } = require('resend');
const logger = require('../utils/logger');

const {
  SUPPORT_EMAIL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  RESEND_OWNER_EMAIL
} = process.env;

const ownerEmail = RESEND_OWNER_EMAIL || SUPPORT_EMAIL;
const resendConfigured = Boolean(RESEND_API_KEY);
const resendClient = resendConfigured ? new Resend(RESEND_API_KEY) : null;
const resendFromAddress = RESEND_FROM_EMAIL || 'Health Prediction <onboarding@resend.dev>';
const adminRecipientFallback = ownerEmail || SUPPORT_EMAIL || 'healthpredicts@gmail.com';

if (!resendConfigured) {
  logger.warn('RESEND_API_KEY is not configured in backend/.env. Email delivery will fail until RESEND_API_KEY is provided.');
}

async function sendMail(mailOptions) {
  const options = {
    from: mailOptions.from || resendFromAddress,
    ...mailOptions
  };

  if (!resendConfigured) {
    logger.error('Resend is not configured. Email will not be delivered.');
    return {
      error: true,
      message: 'Operation completed successfully, but email could not be delivered.'
    };
  }

  console.log('=== sendMail() EXECUTED ===');
  const payload = {
    from: options.from,
    to: options.to,
    subject: options.subject || 'No subject',
    html: options.html,
    text: options.text
  };

  console.log('RESEND_API_KEY loaded:', !!process.env.RESEND_API_KEY);
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL);
  console.log('SUPPORT_EMAIL:', process.env.SUPPORT_EMAIL);
  console.log('RESEND_OWNER_EMAIL:', process.env.RESEND_OWNER_EMAIL);
  console.log('Sending email...');
  console.log('=== Sending Payload ===');
  console.log(JSON.stringify(payload, null, 2));
  logger.info(`Sending email to ${options.to} with subject "${payload.subject}"`);

  if (options.attachments?.length) {
    payload.attachments = options.attachments.map((attachment) => ({
      name: attachment.filename || attachment.name,
      type: attachment.contentType || attachment.type || 'application/octet-stream',
      data: Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content || '').toString('base64')
    }));
  }

  try {
    const response = await resendClient.emails.send(payload);
    // Log full response for observability and debugging
    console.log('Email sent successfully');
    console.log('=== RESEND RESPONSE START ===');
    console.log(JSON.stringify(response, null, 2));
    console.log('=== RESEND RESPONSE END ===');
    if (response?.error) {
      console.error('RESEND ERROR:', response.error);
    }
    if (response?.data) {
      console.log('RESEND DATA:', response.data);
    }
    logger.info(`Email sent successfully to ${options.to} via Resend; response logged`);

    return { ok: true, provider: 'resend', response };
  } catch (error) {
    // Log full error for debugging (may include HTTP response body)
    console.error(`Resend delivery failed for ${options.to}: ${error && error.message}`);
    logger.error(`Resend delivery failed for ${options.to}: ${error && error.message}`, { error });
    logger.error('Resend payload:', payload);

    // Special-case: Resend test-mode validation error prevents sending to arbitrary addresses.
    // If configured, retry sending to a verified owner address so admin notices can still arrive.
    try {
      const errMsg = (error?.message || error?.error?.message || error?.response?.data?.message || '').toString();
      const owner = ownerEmail;
      const testModePattern = /test.*email|testing emails|verified.*email|own email address|only send .*testing emails/i;

      if (owner && testModePattern.test(errMsg) && owner !== options.to) {
        logger.info(`Resend in test-mode: retrying delivery to configured owner email=${owner}`);
        const retryPayload = { ...payload, to: owner };
        const retryResp = await resendClient.emails.send(retryPayload);
        logger.info(`Retry email sent to owner ${owner}; respId=${retryResp?.id || retryResp?.messageId || null}`);
        return { ok: true, provider: 'resend', retriedTo: owner, response: retryResp };
      }

      if (testModePattern.test(errMsg) && !owner) {
        logger.warn('Resend test-mode email validation failed and no RESEND_OWNER_EMAIL/SUPPORT_EMAIL fallback is configured.');
      }
    } catch (retryErr) {
      logger.warn('Retry to configured owner email failed', retryErr);
    }

    return {
      error: true,
      message: error?.message || 'Operation completed, but email could not be delivered.',
      detail: error
    };
  }
}

function buildRegistrationBody(patient) {
  const prediction = patient.remarks?.possibleCondition || 'Not available';
  const recommendation = patient.remarks?.recommendation || 'No recommendation available.';

  return `🏥 Health Prediction System

Hello ${patient.name},

Your health prediction has been generated successfully.

Prediction:
${prediction}

Recommendation:
${recommendation}

If you have any symptoms, please consult a healthcare professional.

Thank you.

Health Prediction System`;
}

function buildHighRiskBody(patient) {
  return `🏥 Health Prediction System

Dear ${patient.name},

Our Health Prediction System has identified your result as HIGH RISK.

We strongly recommend that you consult a qualified doctor as soon as possible for further medical evaluation.

Please do not ignore this notification.

Stay safe.

Regards,

Health Prediction System`;
}

function buildAccountRequestBody(request) {
  return `🏥 Health Prediction System

Hello ${request.fullName || request.username},

Thank you for submitting an account creation request.

Your request has been received and is pending approval. We will notify you once the account has been approved.

Requested Username: ${request.username}
Requested Email: ${request.email}

If you did not make this request, please ignore this message.

Thank you,
Health Prediction System`;
}

function buildPasswordResetBody(admin, resetToken) {
  const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `🏥 Health Prediction System

Hello ${admin.fullName || admin.username},

A password reset request was approved. Use the following OTP to complete the reset process:

${resetToken}

This OTP expires in 30 minutes.

If your application supports it, you can also open the reset page directly:
${clientUrl}/reset-password?token=${resetToken}

If you did not request this, please ignore this message.

Thank you,
Health Prediction System`;
}

async function sendAccountRequestNotification(request) {
  if (!request || !request.email) {
    throw new Error('Request email not available');
  }

  const options = {
    to: request.email,
    subject: 'Account Request Received',
    text: buildAccountRequestBody(request)
  };

  if (SUPPORT_EMAIL) {
    options.bcc = SUPPORT_EMAIL;
  }

  return sendMail(options);
}

function buildAdminAccountRequestBody(request) {
  // On Render, RENDER_EXTERNAL_URL is injected automatically; fall back to it
  // so the email approve/reject links point at the live backend, not localhost.
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
  const approveLink = `${backendUrl}/api/pending-requests/${request._id}/approve`;
  const rejectLink = `${backendUrl}/api/pending-requests/${request._id}/reject`;

  // HTML body with styled approve/reject buttons
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

      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        Thank you,<br />
        Health Prediction System
      </p>
    </div>
  `;

  return { html: htmlBody, text: buildAdminAccountRequestBodyText(request) };
}

function buildAdminAccountRequestBodyText(request) {
  return `🏥 Health Prediction System

A new account creation request has been submitted and is pending approval.

Name: ${request.fullName}
Username: ${request.username}
Email: ${request.email}
Mobile: ${request.mobile || 'N/A'}
Requested Role: ${request.role}
Request Type: ${request.requestType}

Review and approve this request in the admin panel.

Thank you,
Health Prediction System`;
}

async function sendAdminAccountRequestNotification(request) {
  console.log('=== sendAdminAccountRequestNotification CALLED ===');
  const adminRecipient = adminRecipientFallback;
  console.log('Admin Recipient:', adminRecipient);

  const emailContent = buildAdminAccountRequestBody(request);

  const options = {
    to: adminRecipient,
    subject: `New Account Request: ${request.username}`,
    text: emailContent.text,
    html: emailContent.html
  };

  return sendMail(options);
}

function buildAdminPasswordResetRequestBody(admin) {
  const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return {
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0d47a1;">🏥 Health Prediction System</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Password Reset Requested</p>
        </div>
        <p>Dear Super Admin,</p>
        <p>An admin account has requested a password reset.</p>
        <div style="background-color: #f9fafb; border-left: 4px solid #0d47a1; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${admin.username}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${admin.email}</p>
          <p style="margin: 0 0 10px 0;"><strong>Full Name:</strong> ${admin.fullName || 'N/A'}</p>
        </div>
        <p>Use the admin panel to approve or reject this password reset request.</p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">Thank you,<br />Health Prediction System</p>
      </div>
    `,
    text: `🏥 Health Prediction System

A password reset request has been submitted.

Username: ${admin.username}
Email: ${admin.email}
Full Name: ${admin.fullName || 'N/A'}

Use the admin panel to approve or reject this request.

Thank you,
Health Prediction System`
  };
}

async function sendAdminPasswordResetRequestNotification(admin) {
  const adminRecipient = adminRecipientFallback;
  const emailContent = buildAdminPasswordResetRequestBody(admin);

  const options = {
    to: adminRecipient,
    subject: `Password Reset Requested for ${admin.username}`,
    html: emailContent.html,
    text: emailContent.text
  };

  return sendMail(options);
}

async function sendPasswordReset(admin, resetToken) {
  const options = {
    to: admin.email,
    subject: 'Password Reset OTP',
    text: buildPasswordResetBody(admin, resetToken)
  };

  if (SUPPORT_EMAIL) {
    options.bcc = SUPPORT_EMAIL;
  }

  return sendMail(options);
}

async function sendPatientNotification(patient) {
  if (!patient || !patient.email) {
    throw new Error('Patient email not available');
  }

  return sendMail({
    to: patient.email,
    subject: 'Health Prediction Report',
    text: buildRegistrationBody(patient)
  });
}

async function sendPatientReport(patient, pdfBuffer) {
  if (!patient || !patient.email) {
    throw new Error('Patient email not available');
  }

  const filename = `Health_Report_${(patient.name || 'Patient').replace(/\s+/g, '_')}.pdf`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin-bottom: 0;">🏥 Health Prediction System</h2>
      <p style="margin-top: 4px; color: #475569;">Your Health Prediction Report</p>
      <p>Dear ${patient.name},</p>
      <p>Thank you for using the Health Prediction System.</p>
      <p>Your health assessment has been completed successfully.</p>
      <p>Please find your Health Prediction Report attached as a PDF.</p>
      <p><strong>If your result indicates High Risk, we strongly recommend consulting a qualified healthcare professional as soon as possible.</strong></p>
      <p>Thank you,<br />Health Prediction System</p>
    </div>
  `;

  return sendMail({
    to: patient.email,
    subject: 'Your Health Prediction Report',
    text: `Dear ${patient.name},\n\nThank you for using the Health Prediction System.\n\nYour health assessment has been completed successfully.\n\nPlease find your Health Prediction Report attached as a PDF.\n\nIf your result indicates High Risk, we strongly recommend consulting a qualified healthcare professional as soon as possible.\n\nThank you.\n\nHealth Prediction System`,
    html: htmlBody,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

async function sendHighRiskAlert(patient) {
  if (!patient || !patient.email) {
    throw new Error('Patient email not available');
  }

  return sendMail({
    to: patient.email,
    subject: 'Urgent Health Alert',
    text: buildHighRiskBody(patient)
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
    if (result.status === 'fulfilled') {
      summary.success += 1;
    } else {
      summary.failed += 1;
      summary.failures.push({
        patientId: patients[index]._id || patients[index].id,
        email: patients[index].email,
        error: result.reason?.message || 'Unknown error'
      });
      logger.warn(`Bulk email failed for ${patients[index].email}: ${result.reason?.message}`);
    }
  });

  return summary;
}

module.exports = {
  sendMail,
  sendPatientNotification,
  sendPatientReport,
  sendHighRiskAlert,
  sendBulkHighRiskAlerts,
  sendPasswordReset,
  sendAdminPasswordResetRequestNotification,
  sendAccountRequestNotification,
  sendAdminAccountRequestNotification
};
