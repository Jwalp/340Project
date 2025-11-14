# 340Project
# FileVerse

A full-stack MEAN application with **Angular frontend**, **Express backend**, and **MongoDB** database.  
This is my project for IT340.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Build for Production](#build-for-production)
- [Notes](#notes)

---

## Project Structure

YOUR_REPO_NAME/
├─ backend/ # Express / Node backend
│ ├─ node_modules/
│ ├─ routes/
│ ├─ models/
│ ├─ controllers/
│ ├─ middleware/
│ ├─ .env.example
│ └─ index.js (or server.js)
├─ frontend/ # Angular frontend
│ ├─ node_modules/
│ ├─ src/
│ ├─ angular.json
│ └─ package.json
├─ .gitignore
└─ README.md

yaml
Copy code

---

## Prerequisites

Before running the project, make sure you have:

- **Node.js** (v18+ recommended)
- **npm** (or yarn)
- **MongoDB** (local or cloud URI)
- **Angular CLI** (globally installed):  

```bash 
npm install -g @angular/cli
Installation
```
1. Clone the repository
Copy code
```bash
git clone https://github.com/jwalp/340Project.git
cd YOUR_REPO_NAME
```
2. Install backend dependencies
```bash
Copy code
cd backend
npm install
```
3. Install frontend dependencies
Copy code
```bash
cd ../frontend
npm install
```
Environment Variables
Create a .env file in the backend/ folder based on .env.example:

Copy code
```ini
PORT=3000
MONGO_URI=mongodb://localhost:27017/your_db_name
JWT_SECRET=your_secret_key
```
Make sure MongoDB is running locally or use a cloud URI.

Running the Application
Start Backend (Express)
bash
Copy code
```bash
cd backend
npm run dev   # if using nodemon
# or
node index.js # replace with your main server file
```
Start Frontend (Angular)
Copy code
```bash
cd frontend
ng serve
```
Frontend runs at http://localhost:4200

Backend runs at http://localhost:3000

Build for Production (Angular)
```bash
Copy code
cd frontend
ng build --prod
```
Output goes to frontend/dist/

Configure Express to serve the built Angular app for production.

Notes
Make sure backend and frontend ports do not conflict.

Use Postman or similar tools to test API endpoints.

Add any extra instructions for seeding data, testing, or deployment here.






C
