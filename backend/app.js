// backend/app.js
require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const passport = require('./config/passport');
const connectDB = require('./config/database');
const filePurgeService = require('./services/filePurgeService');

// Import routes
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const filesRouter = require('./routes/files');
const conversionRouter = require('./routes/conversion');

// Connect to MongoDB
connectDB();

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:4200',
    'http://localhost:4200'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Passport middleware
app.use(passport.initialize());

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (must come BEFORE static file serving)
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/conversion', conversionRouter);

// Serve Angular frontend in production
if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Production mode: Serving Angular frontend');
  
  // Serve static files from Angular build
  const frontendPath = path.join(__dirname, '../frontend/dist/frontend/browser');
  app.use(express.static(frontendPath));
  
  // All other routes return the Angular app (SPA fallback)
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/users')) {
      return next();
    }
    
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        next(createError(404));
      }
    });
  });
}

// Catch 404
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// Wait for MongoDB connection before starting
const mongoose = require('mongoose');
mongoose.connection.once('open', () => {
  console.log('MongoDB connected - Starting file purge service...');
  filePurgeService.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received - Stopping file purge service...');
  filePurgeService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received - Stopping file purge service...');
  filePurgeService.stop();
  process.exit(0);
});

module.exports = app;
