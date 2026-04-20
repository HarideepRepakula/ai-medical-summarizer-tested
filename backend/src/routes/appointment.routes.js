import express from 'express';
import multer from 'multer';
import path from 'path';
import {
	bookAppointment,
	getAppointments,
	updateAppointmentStatus,
	cancelAppointment,
	rescheduleAppointment,
	getDoctorAvailability,
	cleanupExpiredReservations,
	getAppointmentLockState,
	getAiSummary,
	updateAiSummary,
	uploadConsultationRecord,
	completeConsultation,
	getConsultationRecords,
	getPatientQueries,
	respondToPatientQuery
} from '../controllers/appointment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateAppointmentBooking, validateAppointmentUpdate } from '../middleware/validation.js';

const router = express.Router();

// Multer for consultation record uploads — store in /uploads with unique names
const consultStorage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
	filename:    (_req, file, cb) => {
		const ext    = path.extname(file.originalname);
		const unique = `consult-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
		cb(null, unique);
	}
});
const consultUpload = multer({
	storage: consultStorage,
	limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
	fileFilter: (_req, file, cb) => {
		const allowed = ['image/jpeg','image/png','image/gif','application/pdf',
		                 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
		cb(null, allowed.includes(file.mimetype));
	}
});

// All routes require authentication
router.use(authenticate);

// Core appointment operations
router.post('/book',           validateAppointmentBooking, bookAppointment);
router.get('/',                getAppointments);
router.patch('/:id/status',    validateAppointmentUpdate,  updateAppointmentStatus);
router.delete('/:id/cancel',   cancelAppointment);
router.post('/:id/reschedule', rescheduleAppointment);

// Lock state
router.get('/:id/lock-state',  getAppointmentLockState);

// Consultation lifecycle
router.get('/:id/ai-summary',                    getAiSummary);
router.put('/:id/ai-summary',                    updateAiSummary);
router.post('/:id/upload-record', consultUpload.single('file'), uploadConsultationRecord);
router.post('/:id/complete',                     completeConsultation);
router.get('/:id/records',                       getConsultationRecords);

// Patient queries (escalated from AI chatbot)
router.get('/:id/patient-queries',                          getPatientQueries);
router.post('/:id/patient-queries/:queryId/respond',        respondToPatientQuery);

// Doctor availability
router.get('/availability', getDoctorAvailability);

// Admin
router.post('/cleanup', cleanupExpiredReservations);

export default router;
