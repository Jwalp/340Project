const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // For Gmail
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
      }
    });
  }
  
  // For other SMTP services (recommended for production)
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"FileVerse" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - FileVerse',
      replyTo: process.env.EMAIL_USER, // They can reply to your actual email
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%);
              padding: 40px;
              border-radius: 10px;
              color: #fff;
            }
            .logo {
              text-align: center;
              font-size: 2rem;
              color: #00ff88;
              margin-bottom: 20px;
              text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
            }
            .content {
              background: rgba(45, 27, 78, 0.8);
              padding: 30px;
              border-radius: 10px;
              border: 2px solid rgba(0, 255, 136, 0.3);
            }
            .btn {
              display: inline-block;
              background: linear-gradient(135deg, #00ff88 0%, #00cc6f 100%);
              color: #1a0b2e;
              padding: 14px 30px;
              text-decoration: none;
              border-radius: 10px;
              font-weight: 700;
              margin: 20px 0;
              box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #b8b8d4;
              font-size: 0.9rem;
            }
            .warning {
              background: rgba(255, 77, 77, 0.2);
              color: #ff6b6b;
              padding: 12px;
              border-radius: 8px;
              margin-top: 20px;
              border: 1px solid rgba(255, 77, 77, 0.5);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🚀 FileVerse</div>
            <div class="content">
              <h2 style="color: #00ff88; margin-top: 0;">Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset your password for your FileVerse account. Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="btn">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #00ff88;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from FileVerse. Please do not reply to this email.</p>
              <p>&copy; 2025 FileVerse. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - FileVerse
        
        Hello,
        
        We received a request to reset your password for your FileVerse account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
        
        This is an automated message from FileVerse. Please do not reply to this email.
        
        © 2025 FileVerse. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Verify email configuration
exports.verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};