const PendingRequest = require('../models/PendingRequest');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');
const { sendForgotPasswordOTP } = require('../services/brevoEmailService');
const { sendMail } = require('../services/resendEmailService');

const expireStalePendingRequests = async () => {
  const now = new Date();
  const expiryThreshold = new Date(now.getTime() - 60 * 60 * 1000);

  await PendingRequest.updateMany(
    {
      status: 'Pending',
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $lte: now } },
        { createdAt: { $lte: expiryThreshold } }
      ]
    },
    { status: 'Expired', expiresAt: now }
  );
};

exports.getPendingRequests = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const requests = await PendingRequest.find({ status: 'Pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    logger.error('Get pending requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending requests' });
  }
};

exports.getPendingCounts = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const pendingAccountRequests = await PendingRequest.countDocuments({ requestType: 'AccountCreation', status: 'Pending', expiresAt: { $gt: new Date() } });
    const pendingPasswordResetRequests = await PendingRequest.countDocuments({ requestType: 'PasswordReset', status: 'Pending', expiresAt: { $gt: new Date() } });
    res.json({
      success: true,
      pendingAccountRequests,
      pendingPasswordResetRequests
    });
  } catch (error) {
    logger.error('Get pending counts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending request counts' });
  }
};

exports.approveAccountRequest = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const request = await PendingRequest.findOne({
      _id: req.params.id,
      requestType: 'AccountCreation',
      status: 'Pending',
      expiresAt: { $gt: new Date() }
    });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending account request not found or expired' });
    }

    const existingAdmin = await Admin.findOne({
      $or: [
        { username: request.username },
        { email: request.email },
        { mobile: request.mobile }
      ]
    });

    if (existingAdmin) {
      return res.status(409).json({ success: false, message: 'A matching admin account already exists' });
    }

    const newAdmin = new Admin({
      fullName: request.fullName,
      username: request.username,
      email: request.email,
      mobile: request.mobile,
      password: request.password,
      role: request.role,
      isActive: true
    });

    await newAdmin.save();
    request.status = 'Approved';
    request.approvedBy = req.admin?.username || 'Super Admin';
    request.approvedAt = new Date();
    await request.save();

    const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const approvalEmailHtml = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0d47a1;">🏥 Health Prediction System</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Account Approved</p>
        </div>

        <p>Dear ${request.fullName},</p>

        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #065f46;">✅ Your Account Has Been Approved!</h3>
          <p>Your account creation request has been approved successfully.</p>
        </div>

        <p><strong>Your Login Details:</strong></p>
        <ul style="background-color: #f9fafb; padding: 16px; border-radius: 4px;">
          <li><strong>Username:</strong> ${request.username}</li>
          <li><strong>Email:</strong> ${request.email}</li>
          <li><strong>Role:</strong> ${request.role || 'Clinic Owner'}</li>
        </ul>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Log in to the Health Prediction System using your username and password</li>
          <li>Update your profile if needed</li>
          <li>Start using the system to manage patient health predictions</li>
        </ol>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${clientUrl}/login" style="display: inline-block; background-color: #0d47a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Go to Login
          </a>
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          If you have any questions or issues, please contact the system administrator.
        </p>

        <p style="color: #999; font-size: 12px;">
          Thank you,<br />
          Health Prediction System
        </p>
      </div>
    `;

    try {
      logger.info('Sending email...');
      const approvalResult = await sendMail({
        to: request.email,
        subject: '✅ Your Account Has Been Approved - Health Prediction System',
        html: approvalEmailHtml,
        text: `Dear ${request.fullName},\n\nYour account creation request has been approved successfully!\n\nUsername: ${request.username}\nEmail: ${request.email}\nRole: ${request.role || 'Clinic Owner'}\n\nYou can now log in to the system at ${clientUrl}/login\n\nThank you,\nHealth Prediction System`
      });
      if (approvalResult?.error) {
        logger.error(`Failed to send approval email to ${request.email}: ${approvalResult.message}`);
        logger.error('Email send error details:', approvalResult.detail || approvalResult);
      } else {
        logger.info('Email sent successfully');
        logger.info(`Approval email sent successfully to ${request.email}`);
      }
    } catch (err) {
      logger.error(`Failed to send approval email: ${err.message}`);
    }

    logger.info(`Approved account request: ${request.username}`);
    res.json({ success: true, message: 'Account request approved successfully' });
  } catch (error) {
    logger.error('Approve account request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve account request' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const request = await PendingRequest.findOne({ _id: req.params.id, status: 'Pending', expiresAt: { $gt: new Date() } });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending request not found or expired' });
    }

    request.status = 'Rejected';
    request.approvedBy = req.admin?.username || 'Super Admin';
    request.approvedAt = new Date();
    await request.save();

    logger.info(`Rejected request: ${request.username} (${request.requestType})`);
    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (error) {
    logger.error('Reject request error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
};

exports.approvePasswordResetRequest = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const request = await PendingRequest.findOne({
      _id: req.params.id,
      requestType: 'PasswordReset',
      status: 'Pending',
      expiresAt: { $gt: new Date() }
    });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending password reset request not found or expired' });
    }

    const admin = await Admin.findOne({
      $or: [{ username: request.username }, { email: request.email }]
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account for password reset not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.resetToken = otp;
    admin.resetTokenExpiry = Date.now() + 30 * 60 * 1000;
    await admin.save();

    logger.info('Sending email...');
    const emailResult = await sendForgotPasswordOTP(admin);
    if (emailResult?.error) {
      logger.error(`Failed to send OTP email to ${admin.email}: ${emailResult.message}`);
      logger.error('Email send error details:', emailResult.detail || emailResult);
      admin.resetToken = null;
      admin.resetTokenExpiry = null;
      await admin.save();
      return res.status(500).json({ success: false, message: 'Password reset approved, but OTP email failed to send.' });
    }
    logger.info('Email sent successfully');

    request.otp = otp;
    request.status = 'Approved';
    request.approvedBy = req.admin?.username || 'Super Admin';
    request.approvedAt = new Date();
    await request.save();

    logger.info(`Approved password reset request: ${request.username}`);
    res.json({ success: true, message: `Password reset approved and OTP sent to ${admin.email}` });
  } catch (error) {
    logger.error('Approve password reset request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve password reset request' });
  }
};

// Public endpoints for email link-based approvals (no auth required)
exports.approveFromEmail = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const request = await PendingRequest.findOne({
      _id: req.params.id,
      requestType: 'AccountCreation',
      status: 'Pending',
      expiresAt: { $gt: new Date() }
    });

    if (!request) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Account Approval</title>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
            .error { color: #dc2626; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2>Request Not Found</h2>
            <p class="error">This account request has expired or is no longer valid.</p>
            <p>Please contact the system administrator for assistance.</p>
          </div>
        </body>
        </html>
      `);
    }

    const existingAdmin = await Admin.findOne({
      $or: [
        { username: request.username },
        { email: request.email },
        { mobile: request.mobile }
      ]
    });

    if (existingAdmin) {
      return res.status(409).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Account Approval</title>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
            .error { color: #dc2626; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2>Account Already Exists</h2>
            <p class="error">An account with this username, email, or mobile number already exists.</p>
            <p>Please contact the system administrator for assistance.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Create the new admin account
    const newAdmin = new Admin({
      fullName: request.fullName,
      username: request.username,
      email: request.email,
      mobile: request.mobile,
      password: request.password,
      role: request.role || 'Clinic Owner',
      isActive: true
    });

    await newAdmin.save();

    // Update request status
    request.status = 'Approved';
    request.approvedAt = new Date();
    await request.save();

    // Send approval confirmation email to user
    const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const approvalEmailHtml = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0d47a1;">🏥 Health Prediction System</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Account Approved</p>
        </div>

        <p>Dear ${request.fullName},</p>

        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #065f46;">✅ Your Account Has Been Approved!</h3>
          <p>Your account creation request has been approved successfully.</p>
        </div>

        <p><strong>Your Login Details:</strong></p>
        <ul style="background-color: #f9fafb; padding: 16px; border-radius: 4px;">
          <li><strong>Username:</strong> ${request.username}</li>
          <li><strong>Email:</strong> ${request.email}</li>
          <li><strong>Role:</strong> ${request.role || 'Clinic Owner'}</li>
        </ul>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Log in to the Health Prediction System using your username and password</li>
          <li>Update your profile if needed</li>
          <li>Start using the system to manage patient health predictions</li>
        </ol>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${clientUrl}/login" style="display: inline-block; background-color: #0d47a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Go to Login
          </a>
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          If you have any questions or issues, please contact the system administrator.
        </p>

        <p style="color: #999; font-size: 12px;">
          Thank you,<br />
          Health Prediction System
        </p>
      </div>
    `;

    try {
      logger.info('Sending email...');
      const approvalResult = await sendMail({
        to: request.email,
        subject: '✅ Your Account Has Been Approved - Health Prediction System',
        html: approvalEmailHtml,
        text: `Dear ${request.fullName},\n\nYour account creation request has been approved successfully!\n\nUsername: ${request.username}\nEmail: ${request.email}\nRole: ${request.role || 'Clinic Owner'}\n\nYou can now log in to the system at ${clientUrl}/login\n\nThank you,\nHealth Prediction System`
      });
      if (approvalResult?.error) {
        logger.error(`Failed to send approval email to ${request.email}: ${approvalResult.message}`);
        logger.error('Email send error details:', approvalResult.detail || approvalResult);
      } else {
        logger.info('Email sent successfully');
        logger.info(`Approval email sent successfully to ${request.email}`);
      }
    } catch (err) {
      logger.error(`Failed to send approval email: ${err.message}`);
    }

    logger.info(`Approved account request from email link: ${request.username}`);

    // Return HTML success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Account Approval</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
          .success { color: #10b981; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          .details { background-color: #f9fafb; padding: 16px; border-radius: 4px; text-align: left; margin: 20px 0; }
          .details p { margin: 8px 0; }
          a { display: inline-block; background-color: #0d47a1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h2>Account Approved Successfully!</h2>
          <p class="success">The account request for <strong>${request.username}</strong> has been approved.</p>
          
          <div class="details">
            <p><strong>Name:</strong> ${request.fullName}</p>
            <p><strong>Username:</strong> ${request.username}</p>
            <p><strong>Email:</strong> ${request.email}</p>
            <p><strong>Role:</strong> ${request.role || 'Clinic Owner'}</p>
          </div>

          <p>A confirmation email has been sent to <strong>${request.email}</strong> with login instructions.</p>
          
          <a href="http://localhost:5173/login">Go to Login</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Approve from email error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Account Approval</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
          .error { color: #dc2626; }
          .icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h2>Approval Failed</h2>
          <p class="error">An error occurred while processing the approval. Please try again or contact support.</p>
        </div>
      </body>
      </html>
    `);
  }
};

exports.rejectFromEmail = async (req, res) => {
  try {
    await expireStalePendingRequests();
    const request = await PendingRequest.findOne({
      _id: req.params.id,
      status: 'Pending',
      expiresAt: { $gt: new Date() }
    });

    if (!request) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Request Rejection</title>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
            .error { color: #dc2626; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2>Request Not Found</h2>
            <p class="error">This request has expired or is no longer valid.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Update request status
    request.status = 'Rejected';
    request.approvedAt = new Date();
    await request.save();

    // Send rejection notification email to user
    const rejectionEmailHtml = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0d47a1;">🏥 Health Prediction System</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Request Status</p>
        </div>

        <p>Dear ${request.fullName},</p>

        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #7f1d1d;">❌ Your Request Has Been Rejected</h3>
          <p>Unfortunately, your account creation request has been rejected.</p>
        </div>

        <p><strong>Request Details:</strong></p>
        <ul style="background-color: #f9fafb; padding: 16px; border-radius: 4px;">
          <li><strong>Username:</strong> ${request.username}</li>
          <li><strong>Email:</strong> ${request.email}</li>
          <li><strong>Status:</strong> Rejected</li>
        </ul>

        <p>If you believe this is a mistake or have questions, please contact the system administrator.</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          Thank you,<br />
          Health Prediction System
        </p>
      </div>
    `;

    await sendMail({
      to: request.email,
      subject: 'Account Request Status - Health Prediction System',
      html: rejectionEmailHtml,
      text: `Dear ${request.fullName},\n\nUnfortunately, your account creation request has been rejected.\n\nUsername: ${request.username}\nEmail: ${request.email}\n\nIf you have questions, please contact the system administrator.\n\nThank you,\nHealth Prediction System`
    });

    logger.info(`Rejected request from email link: ${request.username}`);

    // Return HTML rejection page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Request Rejection</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
          .info { color: #666; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          .details { background-color: #f9fafb; padding: 16px; border-radius: 4px; text-align: left; margin: 20px 0; }
          .details p { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h2>Request Rejected</h2>
          <p class="info">The account request for <strong>${request.username}</strong> has been rejected.</p>
          
          <div class="details">
            <p><strong>Name:</strong> ${request.fullName}</p>
            <p><strong>Username:</strong> ${request.username}</p>
            <p><strong>Email:</strong> ${request.email}</p>
          </div>

          <p>A rejection notification has been sent to the provided email address.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Reject from email error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Request Rejection</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
          .error { color: #dc2626; }
          .icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h2>Rejection Failed</h2>
          <p class="error">An error occurred while processing the rejection. Please try again or contact support.</p>
        </div>
      </body>
      </html>
    `);
  }
};
