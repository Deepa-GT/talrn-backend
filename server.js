import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const users = new Map();
const otpStore = new Map();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ Server is running in DEMO mode',
    timestamp: new Date().toISOString()
  });
});

// Send OTP (Demo mode - no real email)
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (users.has(email)) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    
    otpStore.set(email, { otp, expiry: otpExpiry });

    console.log(`📧 DEMO OTP for ${email}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully (DEMO MODE)',
      demo_otp: otp, // Send OTP in response for demo
      note: 'Check console for OTP in demo mode'
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({ 
      success: true, 
      message: 'OTP sent in demo mode',
      demo_otp: '123456'
    });
  }
});

// Verify OTP and Register
app.post('/api/verify-register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Demo mode - accept any 6-digit OTP
    if (otp.length === 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = {
        email,
        password: hashedPassword,
        createdAt: new Date(),
        isVerified: true
      };

      users.set(email, user);
      otpStore.delete(email);

      const token = jwt.sign(
        { email: user.email }, 
        process.env.JWT_SECRET || 'demo-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Registration successful! Welcome to Talrn.',
        token,
        user: { email: user.email, createdAt: user.createdAt }
      });
    } else {
      res.status(400).json({ error: 'OTP must be 6 digits' });
    }

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

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    
    otpStore.set(email, { otp, expiry: otpExpiry });

    console.log(`📧 NEW DEMO OTP for ${email}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'New OTP sent successfully (DEMO MODE)',
      demo_otp: otp
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({ 
      success: true, 
      message: 'OTP resent in demo mode',
      demo_otp: '654321'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (DEMO MODE)`);
});