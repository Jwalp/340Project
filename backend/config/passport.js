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
        // Check if user exists by email
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // User exists, update googleId if not set and mark as verified
          if (!user.googleId) {
            user.googleId = profile.id;
            user.isEmailVerified = true; // Mark as verified for Google users
            await user.save();
          }
          return done(null, user);
        }

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

        done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        done(error, null);
      }
    }
  )
);

module.exports = passport;