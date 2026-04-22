# ClinIQ — AI-Augmented Healthcare Platform

A full-stack MERN + Python AI healthcare system with role-based dashboards and a dual-AI pipeline (BART + Ollama RAG).

---

## Core AI Pipeline

```
Patient uploads file
       ↓
BART (facebook/bart-large-cnn) — abstractive summary + medication extraction
       ↓
Saved to Appointment.aiPreparedSummary (MongoDB)
       ↓
Doctor views pre-consultation briefing
       ↓
Ollama (Llama 3.2) RAG Chatbot — answers patient questions using BART summaries as context
       ↓
CDSS — OpenFDA drug lookup + Ollama clinical reasoning
       ↓
Doctor writes prescription → auto-cart → pharmacy order
```

---

## Features

### AI & Clinical Intelligence
- **BART Summarizer** — `facebook/bart-large-cnn` via Python child process; generates abstractive summaries and extracts medication names from uploaded records
- **Pre-Consultation Briefing** — Doctor receives an AI-prepared patient brief before each appointment (cached in DB after first generation)
- **RAG Chatbot** — Ollama (Llama 3.2) answers patient questions using their full medical history: BART summaries, lab results, prescriptions, and consultation transcripts as context
- **Consultation-Scoped Chatbot** — Post-appointment chatbot scoped to a specific meeting's transcript, summary, and prescribed medicines
- **CDSS Drug Check** — OpenFDA API for official drug warnings + Ollama for clinical reasoning; graceful fallback to FDA-only if Ollama is offline
- **AI Health Insights** — Personalized tips generated from latest lab results via Ollama
- **AI Scribe** — Saves consultation transcripts (raw text + segments) to MongoDB with upsert per appointment

### Clinical Workflow
- Role-based dashboards: Doctor, Patient, Nurse, Admin
- Appointment booking and management
- Online prescription pad → auto-triggers pharmacy cart
- External prescription upload (patient-side)
- Medical record upload with OCR text extraction (pdfplumber / Tesseract)
- Lab result parsing with structured data and flagging
- Doctor escalation pathway from chatbot
- Jitsi video consultation integration

### System
- JWT authentication with refresh tokens
- RBAC middleware
- Real-time notifications
- Pharmacy inventory and order management
- Schedule management (available slots, blocked time)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, MongoDB, Mongoose |
| AI Summarization | Python, `facebook/bart-large-cnn`, PyTorch, pdfplumber |
| AI Reasoning | Ollama (Llama 3.2) — local inference |
| Drug Safety | OpenFDA REST API |
| Frontend | React, Vite, TailwindCSS |
| Auth | JWT + bcrypt |
| Video | Jitsi Meet |

---

## Quick Start

### 1. Install Dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Python (for BART)
pip install torch transformers pdfplumber
```

### 2. Environment
`backend/.env` requires:
```
MONGO_URI=<your-mongodb-atlas-uri>
JWT_SECRET=<your-secret>
UPLOADS_BASE_URL=http://127.0.0.1:4000/uploads
```

### 3. Seed Database
```bash
cd backend && npm run seed
```

### 4. Start Servers
```bash
# Terminal 1 — Backend (port 4000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

> **Note:** On first use of "Pre-Consult Summary," BART takes ~10 seconds to warm up. The frontend shows a loading spinner during this time.

> **Python path:** If `python --version` fails on your machine, change `spawn("python", ...)` to `spawn("python3", ...)` in `ai.controller.js`.

---

## Demo Accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@medhub.com | Admin123! |
| Doctor | sarah.johnson@medhub.com | Doctor123! |
| Nurse | jane.smith@medhub.com | Nurse123! |
| Patient | Register via signup form | (strong password required) |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Register |
| GET | `/api/ai/pre-consult-summary/:id` | BART briefing for doctor |
| POST | `/api/ai/cdss-check` | Drug safety check |
| GET | `/api/ai/health-insights` | Patient health tips |
| POST | `/api/ai/bart-summary` | Direct BART summarization |
| POST | `/api/ai/save-transcript` | Save AI scribe transcript |
| POST | `/api/chatbot/ask` | RAG chatbot (general) |
| POST | `/api/chatbot/ask-consultation` | RAG chatbot (consultation-scoped) |
| POST | `/api/chatbot/escalate` | Escalate query to doctor |
| GET | `/api/doctors` | List doctors |
| GET/POST | `/api/appointments` | Appointments |
| POST | `/api/prescriptions` | Create prescription |
| POST | `/api/medical-records/upload` | Upload patient record |

---

## Project Structure
```
ClinIQ/
├── backend/
│   ├── summarize.py              # BART summarizer (Python)
│   └── src/
│       ├── controllers/
│       │   ├── ai.controller.js          # BART bridge, CDSS, health insights
│       │   ├── chatbot.controller.js     # RAG chatbot, escalation
│       │   ├── prescription.controller.js
│       │   ├── medicalRecords.controller.js
│       │   └── ...
│       ├── services/
│       │   └── ollamaService.js          # Ollama (Llama 3.2) integration
│       └── models/
└── frontend/
    └── src/
        ├── components/
        │   ├── RAGChatbot.jsx
        │   ├── CDSSAlert.jsx
        │   ├── AIHealthInsights.jsx
        │   └── ...
        └── pages/dashboards/
```
