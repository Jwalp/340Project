// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const bcrypt = require('bcryptjs');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth callback - Profile:', profile.emails[0].value);
        
        // Check if user exists by email
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          console.log('User exists:', user.email);
          // User exists, update googleId if not set and mark as verified
          if (!user.googleId) {
            user.googleId = profile.id;
          }
          // IMPORTANT: Always mark Google users as verified
          user.isEmailVerified = true;
          await user.save();
          console.log('User updated - isEmailVerified:', user.isEmailVerified);
          return done(null, user);
        }

        console.log('Creating new Google user');
        // Create new user from Google profile
        const randomPassword = 'google-oauth-' + Math.random().toString(36).substring(2, 15);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        user = await User.create({
          username: profile.displayName.replace(/\s+/g, '_').toLowerCase() + Math.floor(Math.random() * 1000),
          email: profile.emails[0].value,
          password: hashedPassword,
          googleId: profile.id,
          isEmailVerified: true // Google users are automatically verified
        });

        console.log('New user created - isEmailVerified:', user.isEmailVerified);
        done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        done(error, null);
      }
    }
  )
);

module.exports = passport;