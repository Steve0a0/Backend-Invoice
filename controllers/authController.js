const User = require("../model/User");
const InvoiceTemplate = require("../model/InvoiceTemplate");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory store for rate limiting (use Redis in production)
const loginAttempts = new Map();
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Create default invoice templates for new user
const createDefaultTemplate = async (userId) => {
  try {
    // Template 1: Modern Clean Invoice
    const modernTemplatePath = path.join(__dirname, '../templates/modern-clean-invoice.html');
    const modernTemplateHTML = fs.readFileSync(modernTemplatePath, 'utf-8');

    await InvoiceTemplate.create({
      userId: userId,
      title: "Modern Clean Invoice",
      description: "Professional invoice template with clean design",
      category: "Professional",
      currency: "USD",
      templateHTML: modernTemplateHTML
    });

    // Template 2: Classic Professional Invoice
    const classicTemplatePath = path.join(__dirname, '../templates/classic-professional-invoice.html');
    const classicTemplateHTML = fs.readFileSync(classicTemplatePath, 'utf-8');

    await InvoiceTemplate.create({
      userId: userId,
      title: "Classic Professional Invoice",
      description: "Professional invoice template with classic serif typography and clean layout",
      category: "Professional",
      currency: "USD",
      templateHTML: classicTemplateHTML
    });

  } catch (error) {
    console.error('Error creating default templates:', error);
    // Don't throw error - user can still use the app without templates
  }
};

// Password validation function
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return errors;
};

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize input to prevent injection
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

// Check rate limiting
const checkRateLimit = (identifier) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Clean up old attempts
  const recentAttempts = attempts.filter(time => now - time < LOCKOUT_DURATION);
  loginAttempts.set(identifier, recentAttempts);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const oldestAttempt = Math.min(...recentAttempts);
    const lockoutRemaining = Math.ceil((LOCKOUT_DURATION - (now - oldestAttempt)) / 1000 / 60);
    return { 
      allowed: false, 
      remainingAttempts: 0,
      lockoutMinutes: lockoutRemaining
    };
  }

  return { 
    allowed: true, 
    remainingAttempts: MAX_ATTEMPTS - recentAttempts.length 
  };
};

// Record failed attempt
const recordFailedAttempt = (identifier) => {
  const attempts = loginAttempts.get(identifier) || [];
  attempts.push(Date.now());
  loginAttempts.set(identifier, attempts);
};

// Clear attempts on successful login
const clearAttempts = (identifier) => {
  loginAttempts.delete(identifier);
};

const createUser = async (req, res) => {
  try {
    let { name, email, password, companyName } = req.body;

    // Sanitize inputs
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    companyName = sanitizeInput(companyName);

    // Validate required fields
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate name length
    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters long" });
    }

    // Validate company name
    if (companyName.length < 2) {
      return res.status(400).json({ message: "Company name must be at least 2 characters long" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        message: "Password does not meet security requirements",
        errors: passwordErrors 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // Hash password
    const saltRounds = 12; // Increased from 10 for better security
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Create user (not verified yet)
    const user = await User.create({
      name,
      email: email.toLowerCase(), // Store email in lowercase
      password: hashedPassword,
      companyName,
      isEmailVerified: false,
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
    });

    // Send OTP email
    try {
      // Check if email credentials are configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.status(201).json({ 
          message: "Account created! OTP: " + otp + " (Email not configured, OTP shown here for testing)",
          requiresVerification: true,
          email: user.email
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - Invoice Generator',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to Invoice Generator!</h2>
            <p>Hi ${name},</p>
            <p>Thank you for signing up! Please use the following OTP to verify your email address:</p>
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't create an account, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Invoice Generator - Professional Invoicing Made Easy</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      res.status(201).json({ 
        message: "Account created successfully! Please check your email for the verification code.",
        requiresVerification: true,
        email: user.email
      });

    } catch (emailError) {
      console.error('Email send error:', emailError);
      
      // Still return success but inform user
      res.status(201).json({ 
        message: "Account created! OTP: " + otp + " (Email sending failed, OTP shown here)",
        requiresVerification: true,
        email: user.email
      });
    }

  } catch (error) {
    console.error("Signup Error:", error);
    
    // Handle specific database errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: "An account with this email already exists" });
    }
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors[0].message });
    }

    res.status(500).json({ message: "An error occurred during registration. Please try again." });
  }
};

const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    // Sanitize inputs
    email = sanitizeInput(email);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    // Check rate limiting
    const rateLimit = checkRateLimit(email.toLowerCase());
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        message: `Too many failed login attempts. Please try again in ${rateLimit.lockoutMinutes} minutes.`,
        lockoutMinutes: rateLimit.lockoutMinutes
      });
    }

    // Find user by email
    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      attributes: ["id", "email", "name", "password", "isEmailVerified"],
    });

    // Generic error message to prevent email enumeration
    const genericError = "Invalid email or password";

    if (!user) {
      recordFailedAttempt(email.toLowerCase());
      return res.status(401).json({ message: genericError });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
        requiresVerification: true,
        email: user.email
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      recordFailedAttempt(email.toLowerCase());
      
      const remainingAttempts = rateLimit.remainingAttempts - 1;
      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        return res.status(401).json({ 
          message: `${genericError}. ${remainingAttempts} attempts remaining before account lockout.`
        });
      }
      
      return res.status(401).json({ message: genericError });
    }

    // Clear failed attempts on successful login
    clearAttempts(email.toLowerCase());

    // Generate JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        name: user.name 
      }, 
      process.env.JWT_SECRET, 
      {
        expiresIn: "7d", // 7 days for consistent session length
      }
    );

    

    // Return response (don't include password)
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "An error occurred during login. Please try again." });
  }
};

// Google OAuth Authentication
const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ message: "Email not provided by Google" });
    }

    // Check if user already exists
    let user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Create new user with Google data
      const randomPassword = Math.random().toString(36).slice(-12) + "A1!"; // Random strong password
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
        name: name || "Google User",
        email: email.toLowerCase(),
        password: hashedPassword, // We won't use this, but it's required by schema
        companyName: "Google User", // Default company name
        profileImage: picture || "",
        isEmailVerified: true, // Google emails are verified
      });

      // Create default invoice template for new Google user
      await createDefaultTemplate(user.id);

      
    } else {
      // Update profile image if it changed
      if (picture && user.profileImage !== picture) {
        user.profileImage = picture;
        await user.save();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d", // Longer expiry for OAuth users
      }
    );

    res.status(200).json({
      message: "Google authentication successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: user.profileImage,
      },
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ 
      message: "Google authentication failed. Please try again.",
      error: error.message 
    });
  }
};

// Refresh Token - extends session for active users
const refreshToken = async (req, res) => {
  try {
    // User is already authenticated via middleware (req.user exists)
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new JWT Token with fresh expiry
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d", // Fresh 7-day token
      }
    );

    

    res.status(200).json({
      message: "Token refreshed successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ 
      message: "Failed to refresh token",
      error: error.message 
    });
  }
};

// Forgot Password - Send reset link
const forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;

    // Sanitize input
    email = sanitizeInput(email);

    // Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    // Find user
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save token to user (expires in 1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    // Send email
    try {
      // Check if email credentials are configured
      const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
      const emailPassword = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;

      if (!emailUser || !emailPassword) {
        console.error('❌ Email credentials not configured in environment variables');
        return res.status(500).json({ 
          message: "Email service is not configured. Please contact support." 
        });
      }

      // Use nodemailer to send email
      const transporter = nodemailer.createTransport({
        service: 'Gmail', // You can change this to match your email provider
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      const mailOptions = {
        from: emailUser,
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${user.name},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">This is an automated email, please do not reply.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      

    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Clear the reset token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      
      return res.status(500).json({ 
        message: "Error sending password reset email. Please try again later." 
      });
    }

    res.status(200).json({ 
      message: "If an account with that email exists, a password reset link has been sent." 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      message: "An error occurred while processing your request. Please try again." 
    });
  }
};

// Reset Password - Update password with token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    let { password } = req.body;

    // Validate inputs
    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        message: "Password does not meet security requirements",
        errors: passwordErrors 
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
      }
    });

    if (!user) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new password reset." 
      });
    }

    // Check if token has expired
    if (user.resetPasswordExpires < new Date()) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      
      return res.status(400).json({ 
        message: "Reset token has expired. Please request a new password reset." 
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    

    res.status(200).json({ 
      message: "Password reset successful! You can now login with your new password." 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: "An error occurred while resetting your password. Please try again." 
    });
  }
};

// Verify OTP for email verification
const verifyOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;

    // Sanitize inputs
    email = sanitizeInput(email);
    otp = sanitizeInput(otp);

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find user by email
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified. Please login." });
    }

    // Check if OTP exists
    if (!user.emailVerificationOTP) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    // Check if OTP has expired
    if (new Date() > user.emailVerificationOTPExpires) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Verify OTP
    if (user.emailVerificationOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    // Mark user as verified
    user.isEmailVerified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpires = null;
    await user.save();

    // Create default invoice template for new user
    await createDefaultTemplate(user.id);

    

    // Generate JWT token for auto-login after verification
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ 
      message: "Email verified successfully! You are now logged in.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      message: "An error occurred while verifying OTP. Please try again." 
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    let { email } = req.body;

    // Sanitize input
    email = sanitizeInput(email);

    // Validate input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified. Please login." });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpires = otpExpires;
    await user.save();

    

    // Send OTP email
    try {
      // Check if email credentials are configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        
        
        
        return res.status(200).json({ 
          message: "OTP: " + otp + " (Email not configured, OTP shown here for testing)"
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your New Verification Code - Invoice Generator',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">New Verification Code</h2>
            <p>Hi ${user.name},</p>
            <p>You requested a new verification code. Please use the following OTP to verify your email address:</p>
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Invoice Generator - Professional Invoicing Made Easy</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      

      res.status(200).json({ 
        message: "New verification code sent to your email!"
      });

    } catch (emailError) {
      console.error('Email send error:', emailError);
      
      res.status(200).json({ 
        message: "OTP: " + otp + " (Email sending failed, OTP shown here)"
      });
    }

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      message: "An error occurred while resending OTP. Please try again." 
    });
  }
};

module.exports = { createUser, loginUser, googleAuth, refreshToken, forgotPassword, resetPassword, verifyOTP, resendOTP };
