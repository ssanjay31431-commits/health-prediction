const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { sendPasswordReset, sendAdminPasswordResetRequestNotification, sendAdminAccountRequestNotification } = require('../services/emailService');

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'PAVI';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Pavi@123';

// Generate JWT Token
const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive
    },
    process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateSuperAdminToken = () => {
  return jwt.sign(
    {
      id: 'super-admin',
      username: SUPER_ADMIN_USERNAME,
      role: 'Super Admin',
      isActive: true
    },
    process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const isValidEmail = (email) => {
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
};

const isValidMobile = (mobile) => {
  return /^\d{10}$/.test(mobile);
};

const isStrongPassword = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
};

// Register
exports.register = async (req, res) => {
  try {
    const { fullName, username, email, mobile, password, confirmPassword } = req.body;

    if (!fullName || !username || !email || !mobile || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill out all fields'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must contain exactly 10 digits'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number and special character'
      });
    }

    const existingAdmin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
        { mobile: mobile }
      ]
    });

    if (existingAdmin) {
      const conflictField = existingAdmin.username === username.toLowerCase()
        ? 'Username'
        : existingAdmin.email === email.toLowerCase()
        ? 'Email'
        : 'Mobile number';

      return res.status(409).json({
        success: false,
        message: `${conflictField} is already registered`
      });
    }

    const admin = new Admin({
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile.trim(),
      password
    });

    await admin.save();
    const token = generateToken(admin._id);

    logger.info(`New admin registered: ${admin.username}`);

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Super Admin login using environment credentials
    if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
      const token = generateSuperAdminToken();
      logger.info('Super Admin logged in successfully');
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        admin: {
          id: 'super-admin',
          username: SUPER_ADMIN_USERNAME,
          role: 'Super Admin'
        }
      });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ 
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
    });

    if (!admin) {
      logger.warn(`Login attempt with non-existent admin: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid Username or Password'
      });
    }

    if (!admin.isActive) {
      logger.warn(`Inactive admin login attempt: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Contact Super Admin.'
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn(`Login attempt with wrong password for admin: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid Username or Password'
      });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    // Generate token
    const token = generateToken(admin);
    logger.info(`Admin logged in: ${admin.username}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username or email is required'
      });
    }

    const admin = await Admin.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Generate reset token
    const resetToken = admin.generateResetToken();
    await admin.save();

    logger.info('Sending email...');
    const emailResult = await sendPasswordReset(admin, resetToken);
    if (emailResult?.error) {
      logger.error(`Password reset email failed for ${admin.email}: ${emailResult.message}`);
      logger.error('Email send error details:', emailResult.detail || emailResult);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    logger.info('Email sent successfully');
    logger.info(`Password reset OTP generated for admin: ${admin.username}`);

    try {
      logger.info('Sending email...');
      const adminNotifyResult = await sendAdminPasswordResetRequestNotification(admin);
      if (adminNotifyResult?.error) {
        logger.error(`Failed to send Super Admin notification for password reset request: ${adminNotifyResult.message}`);
      } else {
        logger.info('Email sent successfully');
      }
    } catch (adminNotifyError) {
      logger.error('Super Admin password reset notification failed:', adminNotifyError);
    }

    const responsePayload = {
      success: true,
      message: emailResult?.skipped
        ? 'Password reset OTP generated, but email delivery is not configured.'
        : 'Password reset OTP sent to your registered email address.'
    };

    if (emailResult?.skipped && process.env.SHOW_RESET_TOKEN === 'true') {
      responsePayload.resetToken = resetToken;
      responsePayload.note = 'Email delivery is not configured. Use the token shown below to reset your password.';
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during forgot password'
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const admin = await Admin.findOne({
      resetToken: resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    admin.password = newPassword;
    admin.resetToken = null;
    admin.resetTokenExpiry = null;
    await admin.save();

    logger.info(`Password reset successful for admin: ${admin.username}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during reset password'
    });
  }
};

// Verify Token
exports.verifyToken = async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    logger.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token verification'
    });
  }
};

// Request Account Creation
exports.requestAccountCreation = async (req, res) => {
  try {
    const { fullName, username, email, mobile, password, confirmPassword, role } = req.body;
    const PendingRequest = require('../models/PendingRequest');

    // Validation
    if (!fullName || !username || !email || !mobile || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill out all fields'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must contain exactly 10 digits'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number and special character'
      });
    }

    // Check if username or email already exists
    const existingAdmin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
        { mobile: mobile }
      ]
    });

    if (existingAdmin) {
      const conflictField = existingAdmin.username === username.toLowerCase()
        ? 'Username'
        : existingAdmin.email === email.toLowerCase()
        ? 'Email'
        : 'Mobile number';
      return res.status(409).json({
        success: false,
        message: `${conflictField} is already registered`
      });
    }

    // Check if request already exists and is pending
    const existingRequest = await PendingRequest.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ],
      status: 'Pending',
      requestType: 'AccountCreation'
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: 'A pending account request already exists for this username/email'
      });
    }

    // Create pending request
    const pendingRequest = new PendingRequest({
      requestType: 'AccountCreation',
      fullName,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile.trim(),
      password, // Store temporarily, will be hashed by Admin model when approved
      role: role || 'Clinic Owner',
      status: 'Pending'
    });

    await pendingRequest.save();

    // Send notification email to system admin
    logger.info('Sending email...');
    const emailResult = await sendAdminAccountRequestNotification(pendingRequest);
    if (emailResult?.error) {
      logger.error(`Failed to send account request email: ${emailResult.message}`);
      logger.error('Email send error details:', emailResult.detail || emailResult);
      // Don't fail the request even if email fails
    } else {
      logger.info('Email sent successfully');
    }

    logger.info(`Account creation request submitted: ${username}`);

    return res.status(201).json({
      success: true,
      message: 'Account creation request submitted successfully. The admin will review and approve your request shortly.',
      requestId: pendingRequest._id
    });
  } catch (error) {
    logger.error('Account request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during account request submission'
    });
  }
};
