# FileVerse

A full-stack MEAN application for file management, conversion, and export with automatic file purging capabilities. Built with **Angular 20**, **Express**, **Node.js**, and **MongoDB**.

This is my project for IT340.

---

## 🚀 Features

### File Management
- **Upload & Store**: Upload files up to 500MB (documents, images, audio, video)
- **Auto-Purge System**: Files automatically deleted after 10 minutes (configurable)
- **Keep Permanently**: Option to mark files for permanent storage
- **GridFS Storage**: Large file storage using MongoDB GridFS
- **File Preview**: View and preview uploaded files
- **Download**: Download original files anytime

### File Conversion & Export
- **Image Conversion**: Convert between PNG, JPG, WEBP, GIF, BMP, ICO, SVG
- **Audio Conversion**: Convert between MP3, WAV, OGG, AAC, FLAC, M4A (requires FFmpeg)
- **Video Conversion**: Convert between MP4, WEBM, MOV, AVI, MKV, FLV (requires FFmpeg)
- **Document Conversion**: Convert between TXT, HTML, MD, CSV, JSON, XML, DOCX, RTF, ODT
- **Text Extraction**: Extract editable text from PDF, DOCX, Excel files
- **Client & Server-Side Processing**: Hybrid conversion for optimal performance

### Authentication & Security
- **Email/Password Authentication**: Secure registration and login
- **Google OAuth 2.0**: One-click sign-in with Google
- **Email Verification**: Required email verification for new accounts
- **Password Reset**: Secure password recovery via email
- **JWT Authentication**: Token-based session management
- **Protected Routes**: Middleware-based route protection

### User Experience
- **Responsive Design**: Modern UI with gradient backgrounds and animations
- **Real-time Updates**: Live file status and time remaining display
- **Toast Notifications**: User-friendly feedback system
- **Loading Animations**: Smooth loading states and transitions
- **Settings Management**: Account settings and preferences

---

## 📁 Project Structure

```
340Project/
├── backend/                    # Express/Node.js backend
│   ├── bin/
│   │   └── www                # Server startup script
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   └── passport.js        # Google OAuth configuration
│   ├── controllers/
│   │   ├── authController.js  # Authentication logic
│   │   ├── fileController.js  # File management logic
│   │   └── conversionController.js  # File conversion logic
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── models/
│   │   ├── User.js            # User schema
│   │   └── File.js            # File schema with auto-purge
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── files.js           # File management routes
│   │   ├── conversion.js      # Conversion routes
│   │   ├── index.js           # Base routes
│   │   └── users.js           # User routes
│   ├── services/
│   │   ├── emailService.js    # Email sending (verification, reset)
│   │   └── filePurgeService.js # Automatic file deletion
│   ├── public/
│   │   └── stylesheets/
│   ├── views/                 # Pug templates
│   ├── app.js                 # Express app configuration
│   ├── package.json
│   └── .env.example           # Environment variables template
│
├── frontend/                   # Angular 20 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/     # Main dashboard
│   │   │   │   ├── export/        # File conversion UI
│   │   │   │   ├── home/          # Landing page
│   │   │   │   ├── login/         # Login page
│   │   │   │   ├── my-files/      # File manager
│   │   │   │   ├── navbar/        # Navigation bar
│   │   │   │   ├── register/      # Registration page
│   │   │   │   ├── settings/      # Account settings
│   │   │   │   ├── toast/         # Notification system
│   │   │   │   ├── upload/        # File upload
│   │   │   │   ├── verify-email/  # Email verification
│   │   │   │   ├── resend-verification/
│   │   │   │   ├── forgot-password/
│   │   │   │   └── reset-password/
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts  # HTTP auth interceptor
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts      # Authentication service
│   │   │   │   ├── file.service.ts      # File management service
│   │   │   │   ├── export.service.ts    # Conversion service
│   │   │   │   └── toast.service.ts     # Toast notifications
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   └── app.ts
│   │   ├── environments/
│   │   │   └── environment.ts
│   │   ├── index.html          # Main HTML with library imports
│   │   ├── main.ts
│   │   └── styles.css          # Global styles
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js** v18+ (recommended)
- **npm** or yarn
- **MongoDB** (local installation or cloud URI from MongoDB Atlas)
- **Angular CLI** v20+ (globally installed)
- **FFmpeg** (optional, for audio/video conversion)

### Install Angular CLI globally:
```bash
npm install -g @angular/cli
```

### Install FFmpeg (Optional - for audio/video conversion):
**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use:
```bash
choco install ffmpeg
```

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/jwalp/340Project.git
cd 340Project
```

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` folder:

```ini
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/fileverse

# JWT
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRE=30d

# Frontend URL
FRONTEND_URL=http://localhost:4200

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Email Configuration (for verification emails)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Alternative SMTP Configuration
# EMAIL_HOST=smtp.example.com
# EMAIL_PORT=587
# EMAIL_SECURE=false
```

### Setting up Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Setting up Gmail for emails:
1. Enable 2-factor authentication on your Google account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use the app password in `EMAIL_PASSWORD`

---

## 🚀 Running the Application

### Start MongoDB (if running locally)
```bash
mongod
```

### Start Backend Server
```bash
cd backend
npm run dev          # Development with nodemon
# or
npm start           # Production
```
Backend runs at: **http://localhost:3000**

### Start Frontend Server
```bash
cd frontend
ng serve
```
Frontend runs at: **http://localhost:4200**

---

## 🔧 Configuration Options

### Auto-Purge Settings
Edit `backend/services/filePurgeService.js`:
```javascript
const PURGE_CHECK_INTERVAL = 1 * 60 * 1000;  // Check every 1 minute
const DEFAULT_PURGE_MINUTES = 10;             // Purge after 10 minutes
```

Edit `backend/models/File.js`:
```javascript
const minutes = 10; // ⭐ Change purge time here
```

### File Upload Limits
Edit `backend/routes/files.js`:
```javascript
limits: {
  fileSize: 500 * 1024 * 1024 // 500MB limit
}
```

---

## 🏗️ Build for Production

### Build Frontend
```bash
cd frontend
ng build --configuration production
```
Output: `frontend/dist/frontend/`

### Serve Frontend from Backend
Update `backend/app.js` to serve static files:
```javascript
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist/frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/frontend/index.html'));
});
```

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password/:token` - Reset password
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `DELETE /api/auth/delete-account` - Delete user account

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files` - Get all user files
- `GET /api/files/:id` - Get file by ID
- `GET /api/files/:id/download` - Download file
- `PATCH /api/files/:id/keep-status` - Update keep permanently status
- `DELETE /api/files/:id` - Delete file

### Conversion
- `POST /api/conversion/convert` - Convert file
- `GET /api/conversion/ffmpeg-status` - Check FFmpeg availability

---

## 🎨 Key Features Explained

### Auto-Purge System
Files are automatically deleted after a configurable time period (default: 10 minutes) unless marked as "Keep Permanently". The purge service runs in the background checking for expired files every minute.

### Hybrid Conversion
- **Client-side**: Image conversions use Canvas API for instant processing
- **Server-side**: Audio/video conversions use FFmpeg for professional quality
- **Document**: Text extraction and conversion handled with PDF.js, Mammoth.js, and SheetJS

### File Storage
- Small files: Stored in MongoDB
- Large files: Stored in GridFS (MongoDB's file storage system)
- Automatic cleanup of orphaned GridFS chunks

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
ng test

# E2E tests
cd frontend
ng e2e
```

---

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Email verification required
- Protected API routes
- CORS configuration
- Rate limiting ready
- XSS protection
- Input validation

---

## 📝 Notes

- Make sure MongoDB is running before starting the backend
- Default file purge time is 10 minutes (configurable)
- FFmpeg is optional but required for audio/video conversion
- Use Postman or similar tools to test API endpoints
- Check browser console for debugging information
- Files marked as "Keep Permanently" will never be auto-deleted

---

## 🐛 Troubleshooting

**MongoDB Connection Issues:**
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

**Email Not Sending:**
- Verify Gmail app password is correct
- Check 2FA is enabled on Google account
- Ensure EMAIL_USER and EMAIL_PASSWORD are set in .env

---

## 🤝 Contributing

This is an academic project for IT340. Contributions, issues, and feature requests are welcome!

---

## 📄 License

This project is for educational purposes as part of IT340 coursework.

---

## 👤 Author

**jwalp**
- GitHub: [@jwalp](https://github.com/jwalp)
- Project: [340Project](https://github.com/jwalp/340Project)

---

## 🙏 Acknowledgments

- Angular team for the amazing framework
- MongoDB for database solutions
- FFmpeg for media processing capabilities
- All open-source contributors

---

**FileVerse** - Your files, your way. 🚀
