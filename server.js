import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sgMail from '@sendgrid/mail';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
const users = new Map();
const otpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email using SendGrid
const sendEmail = async (to, subject, html) => {
  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'noreply@talrn.com',
      subject,
      html,
    };
    
    await sgMail.send(msg);
    console.log(`Email sent to: ${to}`);
    return true;
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    return false;
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    if (users.has(email)) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { otp, expiry: otpExpiry });

    // Send email
    const emailSent = await sendEmail(
      email,
      'Talrn - OTP Verification',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; background: linear-gradient(135deg, #007bff, #0056b3); padding: 20px; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">Talrn</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Account Verification</p>
        </div>
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; text-align: center;">Verify Your Email</h2>
          <p style="color: #666; text-align: center;">Your OTP for registration is:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 42px; color: #007bff; margin: 0; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
          </div>
          <p style="color: #888; text-align: center; font-size: 14px;">
            This OTP will expire in 10 minutes.<br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
          <p style="color: #666; margin: 0; font-size: 12px;">&copy; 2024 Talrn. All rights reserved.</p>
        </div>
      </div>
      `
    );

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.json({ 
      success: true, 
      message: 'OTP sent successfully to your email' 
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and Register
app.post('/api/verify-register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check OTP
    const storedOtpData = otpStore.get(email);
    if (!storedOtpData) {
      return res.status(400).json({ error: 'OTP not found or expired. Please request a new OTP.' });
    }

    if (Date.now() > storedOtpData.expiry) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      email,
      password: hashedPassword,
      createdAt: new Date(),
      isVerified: true
    };

    users.set(email, user);

    // Clean up OTP
    otpStore.delete(email);

    // Generate JWT token
    const token = jwt.sign(
      { email: user.email }, 
      process.env.JWT_SECRET || 'talrn-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Registration successful! Welcome to Talrn.',
      token,
      user: {
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Resend OTP
app.post('/api/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { otp, expiry: otpExpiry });

    // Send email
    const emailSent = await sendEmail(
      email,
      'Talrn - New OTP Verification',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; background: linear-gradient(135deg, #007bff, #0056b3); padding: 20px; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">Talrn</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">New OTP Verification</p>
        </div>
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; text-align: center;">Your New OTP</h2>
          <p style="color: #666; text-align: center;">Your new OTP for registration is:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 42px; color: #007bff; margin: 0; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
          </div>
          <p style="color: #888; text-align: center; font-size: 14px;">
            This OTP will expire in 10 minutes.<br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
          <p style="color: #666; margin: 0; font-size: 12px;">&copy; 2024 Talrn. All rights reserved.</p>
        </div>
      </div>
      `
    );

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to resend OTP email' });
    }

    res.json({ 
      success: true, 
      message: 'New OTP sent successfully to your email' 
    });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});