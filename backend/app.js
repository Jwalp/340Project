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
const conversionRouter = require('./routes/conversion'); // NEW

// Connect to MongoDB
connectDB();

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:4200'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/conversion', conversionRouter); // NEW

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