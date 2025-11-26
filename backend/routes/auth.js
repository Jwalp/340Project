// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  register, 
  login, 
  getMe, 
  forgotPassword, 
  resetPassword,
  validateResetToken,
  verifyEmail,
  resendVerification
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Validation rules
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
];

// Regular routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);

// Email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', forgotPasswordValidation, resendVerification);

// Password reset routes
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.get('/validate-reset-token/:resetToken', validateResetToken);
router.put('/reset-password/:resetToken', resetPasswordValidation, resetPassword);

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    session: false
  }),
  (req, res) => {
    try {
      console.log('Google OAuth callback successful for user:', req.user.email);
      
      const payload = {
        id: req.user._id
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE },
        (err, token) => {
          if (err) {
            console.error('JWT sign error:', err);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
          }

          console.log('JWT token generated, redirecting to frontend with user data');
          
          const userData = encodeURIComponent(JSON.stringify({
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
          }));
          
          res.redirect(`${process.env.FRONTEND_URL}?token=${token}&user=${userData}`);
        }
      );
    } catch (error) {
      console.error('Callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

module.exports = router;