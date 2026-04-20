# MedHub — Your Health, Our Priority

A comprehensive MERN stack healthcare management system with role-based dashboards for doctors, patients, nurses, and administrators.

## Features
- 🔐 Secure JWT Authentication with Role-Based Access Control
- 👨‍⚕️ Doctor Dashboard with appointment management
- 🏥 Patient Portal with doctor search and booking
- 👩‍⚕️ Nurse Dashboard for patient care management
- 🔧 Admin Panel for system administration
- 📱 Responsive design with modern UI
- 💬 Real-time chat widget
- 🔔 Toast notifications

## Tech Stack
- **Backend:** Node.js, Express, MongoDB, JWT
- **Frontend:** React, Vite, TailwindCSS
- **Database:** MongoDB Atlas

## Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd "Medical website"

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Setup
The `.env` files are already configured with:
- MongoDB Atlas connection
- JWT secret
- CORS settings

### 3. Seed Database
```bash
cd backend
npm run seed
```

### 4. Start Development Servers
```bash
# Terminal 1 - Backend (Port 4000)
cd backend
npm run dev

# Terminal 2 - Frontend (Port 5173)
cd frontend
npm run dev
```

### 5. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## Demo Accounts
After running the seed script:
- **Admin:** admin@medhub.com / Admin123!
- **Patient:** Create through signup form (requires strong password)
- **Nurse:** jane.smith@medhub.com / Nurse123!
- **Doctor:** sarah.johnson@medhub.com / Doctor123!

## API Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/signup` - User registration
- `GET /api/doctors` - Get all doctors
- `GET /api/appointments` - Get user appointments
- `POST /api/appointments` - Book appointment

## Project Structure
```
Medical website/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── scripts/
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── assets/
    └── package.json
```

## Security Features
- JWT token authentication
- Password hashing with bcrypt
- Input validation
- CORS protection
- Environment variable security

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request


