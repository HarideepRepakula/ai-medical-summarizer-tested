import mongoose from "mongoose";
import { AppointmentModel } from "../models/Appointment.js";
import { DoctorModel } from "../models/Doctor.js";
import { UserModel } from "../models/User.js";
import { MedicalRecordModel } from "../models/MedicalRecord.js";
import { v4 as uuidv4 } from 'uuid';
import { notifyPreConsultReminder } from "../services/notificationService.js";
import {
	generatePatientBriefingSummary
} from "../services/ollamaService.js";
// NOTE: BART Python bridge removed. All AI summarization now uses Ollama.
import {
	notifyBookingConfirmed,
	notifyDoctorReschedule,
	notifyCancellation
} from "../services/notificationService.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a JS Date from an appointment date + time string (HH:MM) */
function buildAppointmentDateTime(dateObj, timeStr) {
	const dt = new Date(dateObj); // comes from DB as UTC
	const [h, m] = timeStr.split(":").map(Number);
	// Use setUTCHours to stay consistent with MongoDB UTC storage
	dt.setUTCHours(h, m, 0, 0);
	return dt;
}

/** Returns minutes until an appointment starts (negative = already started) */
function minutesUntil(appointmentDate, startTime) {
	const aptDt = buildAppointmentDateTime(appointmentDate, startTime);
	return (aptDt.getTime() - Date.now()) / 60000;
}

/** Returns hours until an appointment from now (can be negative if past) */
function hoursUntil(dateObj, timeStr) {
	const aptDt = buildAppointmentDateTime(dateObj, timeStr);
	const now = new Date();
	return (aptDt.getTime() - now.getTime()) / 3600000;
}


const validateAppointmentData = (data) => {
	const { doctorId, appointmentDate, startTime, reason } = data;

	if (!doctorId || !appointmentDate || !startTime || !reason) {
		throw new Error('Missing required fields');
	}

	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(startTime)) {
		throw new Error('Invalid time format. Use HH:MM');
	}

	if (data.endTime) {
		if (!timeRegex.test(data.endTime)) throw new Error('Invalid time format. Use HH:MM');
		const [sh, sm] = startTime.split(':').map(Number);
		const [eh, em] = data.endTime.split(':').map(Number);
		if ((eh * 60 + em) <= (sh * 60 + sm)) throw new Error('End time must be after start time');
	}
};

// ─── Book Appointment ─────────────────────────────────────────────────────────

export async function bookAppointment(req, res) {
	try {
		const { doctorId, appointmentDate, startTime, endTime, reason, notes, urgency = 'normal', visitType = 'regular', consultNow = false } = req.body;
		const patientId = req.user.userId;

		// Consult Now: use current date/time
		const now = new Date();
		const resolvedDate      = consultNow ? now.toISOString().split('T')[0] : appointmentDate;
		const resolvedStartTime = consultNow
			? `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
			: startTime;
		const resolvedEndTime   = endTime || (() => {
			const [h, m] = resolvedStartTime.split(':').map(Number);
			const em = m + 30;
			return `${String(h + Math.floor(em/60)).padStart(2,'0')}:${String(em%60).padStart(2,'0')}`;
		})();

		validateAppointmentData({ doctorId, appointmentDate: resolvedDate, startTime: resolvedStartTime, endTime: resolvedEndTime, reason: reason || visitType });

		// 1. Verify doctor exists
		const doctor = await DoctorModel.findById(doctorId);
		if (!doctor) {
			return res.status(404).json({ success: false, error: 'Doctor not found' });
		}

		// 2. Check for conflicts
		

		const [startHour, startMin] = resolvedStartTime.split(':').map(Number);
		const [endHour, endMin]     = resolvedEndTime.split(':').map(Number);
		const durationMinutes       = (endHour * 60 + endMin) - (startHour * 60 + startMin);

		const appointment = await AppointmentModel.create({
			patientId,
			doctorId: doctor.userId,
			appointmentDate: new Date(resolvedDate),
			startTime:       resolvedStartTime,
			endTime:         resolvedEndTime,
			durationMinutes,
			reason: (reason || visitType).trim(),
			notes: notes?.trim() || '',
			urgency: consultNow ? 'high' : urgency,
			fee: doctor.consultationFee || 0,
			createdBy: patientId,
			status: consultNow ? 'confirmed' : 'pending'
		});

		// Sync file to Medical Records
		if (req.file) {
			try {
				const BASE=process.env.UPLOADS_BASE_URL||"http://localhost:4000/uploads";
				await MedicalRecordModel.create({patientId,recordName:req.file.originalname,fileName:req.file.originalname,fileUrl:BASE+"/"+req.file.filename,fileType:"Other",mimeType:req.file.mimetype,fileSize:req.file.size});
			}catch(e){console.error("[BOOKING] MedicalRecord sync:",e.message);}
		}

		process.nextTick(async () => {
			try {
				const patient = await UserModel.findById(patientId).lean();
				if (patient) {
					await notifyBookingConfirmed(patient, {
						_id:        appointment._id,
						doctorName: doctor.name,
						date:       resolvedDate,
						startTime:  resolvedStartTime,
						endTime:    resolvedEndTime,
						reason
					});
				}
			} catch (err) {
				console.error('[NOTIFICATION] Booking notification failed:', err.message);
			}
		});

		res.status(201).json({
			success: true,
			message: consultNow ? 'Immediate consultation booked' : 'Appointment booked successfully',
			data: {
				appointmentId: appointment._id,
				doctorName:    doctor.name,
				date:          resolvedDate,
				time:          `${resolvedStartTime} - ${resolvedEndTime}`,
				status:        appointment.status,
				fee:           appointment.fee
			}
		});

	} catch (error) {
		console.error('Book appointment error:', error);

		// MongoDB unique index violation — slot already taken
		if (error.code === 11000) {
			return res.status(409).json({ success: false, error: 'This time slot is already booked. Please choose a different time.' });
		}

		const errorMessages = {
			'DOCTOR_NOT_FOUND':                      'Doctor not found',
			'SLOT_ALREADY_BOOKED':                   'This time slot is already booked',
			'Missing required fields':               'Please fill all required fields',
			'Cannot book appointments in the past':  'Cannot book appointments in the past',
			'Invalid time format. Use HH:MM':        'Invalid time format',
			'End time must be after start time':     'End time must be after start time',
			'Minimum appointment duration is 15 minutes': 'Minimum appointment duration is 15 minutes'
		};

		const message    = errorMessages[error.message] || error.message || 'Failed to book appointment';
		const statusCode = error.message === 'SLOT_ALREADY_BOOKED' ? 409 : 400;

		res.status(statusCode).json({ success: false, error: message });
	}
}

// ─── Get Appointments ────────────────────────────────────────────────────────

export async function getAppointments(req, res) {
	try {
		const userId   = req.user.userId;
		const userRole = req.user.role;

		// Pagination parameters
		const page  = Math.max(1, parseInt(req.query.page) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
		const skip  = (page - 1) * limit;

		// Filter parameters
		const { status, date, urgency } = req.query;

		// Build filter
		let filter = {};
		if (userRole === 'PATIENT') {
			filter.patientId = userId;
		} else if (userRole === 'DOCTOR') {
			filter.doctorId = userId;
		}

		if (status)  filter.status  = status;
		if (urgency) filter.urgency = urgency;
		if (date) {
			const queryDate = new Date(date);
			filter.appointmentDate = {
				$gte: new Date(queryDate.setHours(0, 0, 0, 0)),
				$lt:  new Date(queryDate.setHours(23, 59, 59, 999))
			};
		}

		// Execute query with optimized population
		const [appointments, totalCount] = await Promise.all([
			AppointmentModel.find(filter)
				.populate('patientId', 'name phone email')
				.populate('doctorId',  'name phone email specialty')
				.sort({ appointmentDate: 1, startTime: 1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			AppointmentModel.countDocuments(filter)
		]);

		// Format + attach lock state to each appointment
		const formattedAppointments = appointments.map(apt => {
			const mins        = minutesUntil(apt.appointmentDate, apt.startTime);
			const summaryLocked      = mins <= 10 && mins > -30; // locked 10 min before
			const doctorSummaryReady = mins <= 10;               // doctor can see summary

			return {
				id: apt._id,
				patient: {
					id:    apt.patientId._id,
					name:  apt.patientId.name,
					phone: apt.patientId.phone,
					email: apt.patientId.email
				},
				doctor: {
					id:        apt.doctorId._id,
					name:      apt.doctorId.name,
					phone:     apt.doctorId.phone,
					email:     apt.doctorId.email,
					specialty: apt.doctorId.specialty
				},
				date:             apt.appointmentDate.toISOString().split('T')[0],
				startTime:        apt.startTime,
				endTime:          apt.endTime,
				duration:         apt.durationMinutes,
				reason:           apt.reason,
				notes:            apt.notes,
				status:           apt.status,
				urgency:          apt.urgency,
				fee:              apt.fee,
				paymentStatus:    apt.paymentStatus,
				createdAt:        apt.createdAt,
				rescheduledCount: apt.rescheduledCount,
				// Smart lock states for frontend
				summaryLocked,
				doctorSummaryReady,
				minutesUntilStart: Math.round(mins)
			};
		});

		res.json({
			success: true,
			data: {
				appointments: formattedAppointments,
				pagination: {
					currentPage: page,
					totalPages:  Math.ceil(totalCount / limit),
					totalCount,
					hasNext: page < Math.ceil(totalCount / limit),
					hasPrev: page > 1
				}
			}
		});

	} catch (error) {
		console.error('Get appointments error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch appointments' });
	}
}

// ─── Get Lock State (for single appointment) ─────────────────────────────────

/**
 * GET /api/appointments/:id/lock-state
 * Returns the 10-minute lock state for a specific appointment.
 * Used by both Patient (disable notes edit) and Doctor (enable summary button).
 */
export async function getAppointmentLockState(req, res) {
	try {
		const { id }  = req.params;
		const userId  = req.user.userId;

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: must be the patient or the doctor
		if (
			appointment.patientId.toString() !== userId &&
			appointment.doctorId.toString()  !== userId
		) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		const mins              = minutesUntil(appointment.appointmentDate, appointment.startTime);
		const summaryLocked     = mins <= 10 && mins >= -30;  // 10-min window
		const doctorSummaryReady = mins <= 10;
		const threeHourLock     = mins < 180;                  // < 3 hours — can't cancel/reschedule

		res.json({
			success: true,
			data: {
				appointmentId:     id,
				minutesUntilStart: Math.round(mins),
				summaryLocked,          // Patient cannot edit pre-consult notes
				doctorSummaryReady,     // Doctor's "View Summary" button is enabled
				threeHourLock,          // Patient cannot cancel/reschedule
				lockMessages: {
					patient: summaryLocked ? "Pre-consultation notes are locked 10 minutes before your appointment." : null,
					doctor:  doctorSummaryReady ? "AI summary is ready. Your consultation starts soon." : null
				}
			}
		});

	} catch (error) {
		console.error('Get lock state error:', error);
		res.status(500).json({ success: false, error: 'Failed to get lock state' });
	}
}

// ─── Get Consultation Data (Unified Run-Once Endpoint) ───────────────────────

/**
 * GET /api/appointments/:id/consultation-data
 * Single endpoint used by BOTH Patient and Doctor dashboards.
 * - Runs AI summary ONCE, caches it in DB, never regenerates.
 * - Returns T-15/T-10 lock states.
 * - Doctor sees summary only at T-10; patient always sees it.
 */
export async function getConsultationData(req, res) {
	try {
		const { id }   = req.params;
		const userId   = req.user.userId;
		const userRole = req.user.role;

		const appointment = await AppointmentModel.findById(id)
			.populate('patientId', 'name email phone')
			.populate('doctorId',  'name email phone');

		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: must be patient or doctor of this appointment
		const isPatient = appointment.patientId._id.toString() === userId;
		const isDoctor  = appointment.doctorId._id.toString()  === userId;
		if (!isPatient && !isDoctor) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		// ── Timing locks ───────────────────────────────────────────────────────────────────
		const mins             = minutesUntil(appointment.appointmentDate, appointment.startTime);
		const isMeetingEnabled = mins <= 15;
		const isUploadLocked   = mins <= 15;
		const isSummaryLocked  = mins <= 10;
		// Doctor only sees summary at T-10; patient always sees it
		const showSummaryToDoctor = isDoctor ? mins <= 10 : true;

		// ── Run AI summary ONCE ───────────────────────────────────────────────────────────────────
		if (!appointment.aiPreparedSummary?.content) {
			try {
				const { generatePatientBriefingSummary } = await import('../services/ollamaService.js');
				const { PrescriptionModel } = await import('../models/Prescription.js');
				const { LabResultModel }    = await import('../models/LabResult.js');
				const { TranscriptModel }   = await import('../models/Transcript.js');

				const patientId = appointment.patientId._id;
				const [prescriptions, labResults, transcripts] = await Promise.all([
					PrescriptionModel.find({ patientId }).sort({ createdAt: -1 }).limit(5).lean(),
					LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(5).lean(),
					TranscriptModel.find({ patientId }).sort({ createdAt: -1 }).limit(3).lean()
				]);

				const summary = await generatePatientBriefingSummary({
					patientName: appointment.patientId.name,
					reason:      appointment.reason,
					prescriptions,
					labResults,
					transcripts
				});

				// Save once — never regenerate
				appointment.aiPreparedSummary = {
					content:        summary.patientOverview || summary.summary || '',
					editablePoints: summary.discussionPoints || [],
					generatedAt:    new Date(),
					isLocked:       false,
					sharedWithDoctor: false
				};
				await appointment.save();
				console.log(`[AI] Summary generated once for appointment ${id}`);
			} catch (aiErr) {
				console.error('[AI] Summary generation failed:', aiErr.message);
				// Don't block the response — return without summary
			}
		}

		res.json({
			success: true,
			data: {
				appointment: {
					id:              appointment._id,
					patient:         { id: appointment.patientId._id, name: appointment.patientId.name, email: appointment.patientId.email },
					doctor:          { id: appointment.doctorId._id,  name: appointment.doctorId.name,  email: appointment.doctorId.email },
					date:            appointment.appointmentDate,
					startTime:       appointment.startTime,
					endTime:         appointment.endTime,
					reason:          appointment.reason,
					status:          appointment.status,
					linkedRecords:   appointment.linkedRecords || [],
					consultationRecords: appointment.consultationRecords || {},
					aiPreparedSummary:   appointment.aiPreparedSummary || null
				},
				isMeetingEnabled,
				isUploadLocked,
				isSummaryLocked,
				showSummaryToDoctor,
				minutesRemaining: Math.round(mins)
			}
		});

	} catch (error) {
		console.error('Get consultation data error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch consultation data' });
	}
}

// ─── Get Consultation State (Comprehensive Lock State) ──────────────────────

/**
 * GET /api/appointments/:id/consultation-state
 * Returns comprehensive consultation state with all lock timings.
 * Used by frontend to control UI elements (T-15 upload lock, T-10 summary lock, meeting enable).
 */
export async function getConsultationState(req, res) {
	try {
		const { id } = req.params;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: must be the patient or the doctor
		if (
			appointment.patientId.toString() !== userId &&
			appointment.doctorId.toString()  !== userId
		) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		const mins = minutesUntil(appointment.appointmentDate, appointment.startTime);

		res.json({
			success: true,
			data: {
				appointmentId:           id,
				minutesRemaining:        Math.round(mins),
				isMeetingEnabled:        mins <= 15,          // Meeting room opens 15 min before
				isUploadLocked:          mins <= 15,          // File uploads lock 15 min before
				isSummaryLocked:         mins <= 10,          // Patient summary edit locks 10 min before
				isSummaryVisibleToDoctor: mins <= 10,         // Doctor can view summary 10 min before
				threeHourLock:           mins < 180,          // Cancel/reschedule lock (3 hours)
				lockMessages: {
					upload:  mins <= 15 ? 'File uploads are locked 15 minutes before consultation.' : null,
					summary: mins <= 10 ? 'Summary is locked and shared with your doctor.' : null,
					meeting: mins <= 15 ? 'Meeting room is now open. You can join anytime.' : `Meeting opens in ${Math.round(mins - 15)} minutes.`
				}
			}
		});

	} catch (error) {
		console.error('Get consultation state error:', error);
		res.status(500).json({ success: false, error: 'Failed to get consultation state' });
	}
}

// ─── Update Appointment Status ────────────────────────────────────────────────

export async function updateAppointmentStatus(req, res) {
	try {
		const { id }              = req.params;
		const { status, reason }  = req.body;
		const userId              = req.user.userId;

		if (!['pending', 'confirmed', 'cancelled', 'completed', 'in_progress', 'no_show'].includes(status)) {
			return res.status(400).json({ success: false, error: 'Invalid status' });
		}

		const appointment = await AppointmentModel.findById(id);
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		if (appointment.patientId.toString() !== userId && appointment.doctorId.toString() !== userId) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		const validTransitions = {
			'pending':     ['confirmed', 'cancelled'],
			'confirmed':   ['in_progress', 'cancelled', 'no_show'],
			'in_progress': ['completed', 'cancelled'],
			'completed':   [],
			'cancelled':   [],
			'no_show':     []
		};

		if (!validTransitions[appointment.status]?.includes(status)) {
			return res.status(400).json({ success: false, error: 'Invalid status transition' });
		}

		const updated = await AppointmentModel.findByIdAndUpdate(
			id,
			{
				status,
				lastModifiedBy: userId,
				...(status === 'cancelled' && { cancellationReason: reason, cancelledAt: new Date(), cancelledBy: userId }),
				$inc: { version: 1 }
			},
			{ new: true }
		);

		res.json({ success: true, message: 'Appointment updated successfully', data: { id: updated._id, status: updated.status, version: updated.version } });

	} catch (error) {
		console.error('Update appointment error:', error);
		res.status(500).json({ success: false, error: 'Failed to update appointment' });
	}
}

// ─── Cancel Appointment (3-Hour Rule) ────────────────────────────────────────

export async function cancelAppointment(req, res) {
	try {
		const { id } = req.params;
		const { reason } = req.body;
		const userId = req.user.userId;
		const userRole = req.user.role;

		const appointment = await AppointmentModel.findById(id);
		if (!appointment) return res.status(404).json({ success: false, error: 'Appointment not found' });

		if (appointment.patientId.toString() !== userId && appointment.doctorId.toString() !== userId)
			return res.status(403).json({ success: false, error: 'Unauthorized' });

		if (!['pending', 'confirmed'].includes(appointment.status))
			return res.status(400).json({ success: false, error: 'This appointment cannot be cancelled' });

		if (userRole === 'PATIENT') {
			const hrs = hoursUntil(appointment.appointmentDate, appointment.startTime);
			if (hrs < 3) return res.status(423).json({ success: false, error: 'Appointments cannot be cancelled less than 3 hours before the scheduled time.' });
		}

		await AppointmentModel.findByIdAndUpdate(id, {
			status: 'cancelled',
			cancellationReason: reason || 'No reason provided',
			cancelledAt: new Date(),
			cancelledBy: userId,
			lastModifiedBy: userId,
			'$inc': { version: 1 }
		});

		process.nextTick(async () => {
			try {
				const patient = await UserModel.findById(appointment.patientId).lean();
				if (patient) {
					const pop = await AppointmentModel.findById(id).populate('doctorId', 'name').lean();
					await notifyCancellation(patient, {
						_id: appointment._id,
						doctorName: pop?.doctorId?.name || 'Your doctor',
						date: appointment.appointmentDate?.toISOString().split('T')[0],
						startTime: appointment.startTime
					}, userId === appointment.patientId.toString() ? 'Patient' : 'Doctor');
				}
			} catch (err) { console.error('[NOTIFICATION] Cancellation failed:', err.message); }
		});

		res.json({ success: true, message: 'Appointment cancelled successfully' });
	} catch (error) {
		console.error('Cancel appointment error:', error);
		res.status(500).json({ success: false, error: 'Failed to cancel appointment' });
	}
}

// ─── Reschedule Appointment (3-Hour Rule) ────────────────────────────────────

export async function rescheduleAppointment(req, res) {
	try {
		const { id } = req.params;
		const { newDate, newStartTime, newEndTime, reason } = req.body;
		const userId = req.user.userId;
		const userRole = req.user.role;

		const resolvedEndTime = newEndTime || (() => {
			const [h, m] = newStartTime.split(':').map(Number);
			const em = m + 30;
			return String(h + Math.floor(em / 60)).padStart(2, '0') + ':' + String(em % 60).padStart(2, '0');
		})();

		validateAppointmentData({ doctorId: 'temp', appointmentDate: newDate, startTime: newStartTime, endTime: resolvedEndTime, reason: 'reschedule' });

		const orig = await AppointmentModel.findById(id);
		if (!orig) return res.status(404).json({ success: false, error: 'Appointment not found' });

		if (orig.patientId.toString() !== userId && orig.doctorId.toString() !== userId)
			return res.status(403).json({ success: false, error: 'Unauthorized' });

		if (!['pending', 'confirmed'].includes(orig.status))
			return res.status(400).json({ success: false, error: 'This appointment cannot be rescheduled' });

		if (orig.rescheduledCount >= 3)
			return res.status(400).json({ success: false, error: 'Maximum reschedule limit reached (3)' });

		if (userRole === 'PATIENT') {
			const hrs = hoursUntil(orig.appointmentDate, orig.startTime);
			if (hrs < 3) return res.status(423).json({ success: false, error: 'Appointments cannot be rescheduled less than 3 hours before the scheduled time.' });
		}

		const conflicts = await AppointmentModel.findConflicts(orig.doctorId, new Date(newDate), newStartTime, resolvedEndTime, id);
		if (conflicts.length > 0) return res.status(409).json({ success: false, error: 'The new time slot is already booked' });

		const [rsh, rsm] = newStartTime.split(':').map(Number);
		const [reh, rem] = resolvedEndTime.split(':').map(Number);

		const newApt = await AppointmentModel.create({
			patientId: orig.patientId, doctorId: orig.doctorId,
			appointmentDate: new Date(newDate), startTime: newStartTime, endTime: resolvedEndTime,
			durationMinutes: (reh * 60 + rem) - (rsh * 60 + rsm),
			reason: orig.reason,
			notes: (orig.notes || '') + '\n[Rescheduled: ' + (reason || 'No reason provided') + ']',
			urgency: orig.urgency, fee: orig.fee, createdBy: orig.createdBy,
			originalAppointmentId: orig._id, rescheduledCount: orig.rescheduledCount + 1, status: 'pending'
		});

		await AppointmentModel.findByIdAndUpdate(id, {
			status: 'cancelled',
			cancellationReason: 'Rescheduled to ' + newDate + ' ' + newStartTime,
			cancelledAt: new Date(), cancelledBy: userId,
			rescheduledToId: newApt._id, lastModifiedBy: userId,
			'$inc': { version: 1 }
		});

		if (userRole === 'DOCTOR') {
			process.nextTick(async () => {
				try {
					const patient = await UserModel.findById(orig.patientId).lean();
					const doc = await UserModel.findById(userId).lean();
					if (patient) await notifyDoctorReschedule(patient,
						{ _id: orig._id, doctorName: doc?.name || 'Your doctor', date: orig.appointmentDate?.toISOString().split('T')[0], startTime: orig.startTime },
						{ _id: newApt._id, date: newDate, startTime: newStartTime }
					);
				} catch (err) { console.error('[NOTIFICATION] Reschedule failed:', err.message); }
			});
		}

		res.json({ success: true, message: 'Appointment rescheduled successfully', data: { newAppointmentId: newApt._id, date: newDate, time: newStartTime + ' - ' + resolvedEndTime } });
	} catch (error) {
		console.error('Reschedule appointment error:', error);
		res.status(500).json({ success: false, error: error.message || 'Failed to reschedule appointment' });
	}
}

// ─── Get Doctor Availability ─────────────────────────────────────────────────

export async function getDoctorAvailability(req, res) {
	try {
		const { doctorId, date } = req.query;

		if (!doctorId || !date) {
			return res.status(400).json({ success: false, error: 'Doctor ID and date are required' });
		}

		// Bug fix: use $gte/$lt range so the date match works regardless of UTC time component
		const queryDate = new Date(date);
		const dayStart  = new Date(queryDate); dayStart.setUTCHours(0, 0, 0, 0);
		const dayEnd    = new Date(queryDate); dayEnd.setUTCHours(23, 59, 59, 999);

		const bookedSlots = await AppointmentModel.find({
			doctorId,
			appointmentDate: { $gte: dayStart, $lte: dayEnd },
			status: { $in: ['pending', 'confirmed', 'in_progress'] }
		}).select('startTime endTime').lean();

		// Generate available slots (9 AM to 5 PM, 30-minute slots)
		const availableSlots = [];
		for (let hour = 9; hour < 17; hour++) {
			for (let minute = 0; minute < 60; minute += 30) {
				const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
				const endTime   = minute === 30
					? `${(hour + 1).toString().padStart(2, '0')}:00`
					: `${hour.toString().padStart(2, '0')}:30`;

				// Check if slot is available
				const isBooked = bookedSlots.some(slot =>
					(startTime >= slot.startTime && startTime < slot.endTime) ||
					(endTime > slot.startTime   && endTime <= slot.endTime)
				);

				if (!isBooked) {
					availableSlots.push({ startTime, endTime });
				}
			}
		}

		res.json({
			success: true,
			data: {
				date,
				availableSlots,
				bookedSlots: bookedSlots.map(slot => ({
					startTime: slot.startTime,
					endTime:   slot.endTime
				}))
			}
		});

	} catch (error) {
		console.error('Get doctor availability error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch doctor availability' });
	}
}

// ─── Cleanup Expired Reservations ────────────────────────────────────────────

export async function cleanupExpiredReservations(req, res) {
	try {
		const result = await AppointmentModel.cleanupExpiredReservations();
		res.json({ success: true, message: `Cleaned up ${result.deletedCount} expired reservations` });
	} catch (error) {
		console.error('Cleanup error:', error);
		res.status(500).json({ success: false, error: 'Failed to cleanup expired reservations' });
	}
}

// ─── AI Pre-Consultation Summary (GET) ───────────────────────────────────────

/**
 * GET /api/appointments/:id/ai-summary
 * Generate or fetch the AI pre-consultation briefing summary.
 * Available to both patient and doctor.
 */
export async function getAiSummary(req, res) {
	try {
		const { id } = req.params;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id)
			.populate('patientId', 'name email')
			.lean();

		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		const aptPatientId = appointment.patientId._id?.toString() ?? appointment.patientId.toString();
		const aptDoctorId  = appointment.doctorId?.toString();
		if (aptPatientId !== userId && aptDoctorId !== userId) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		// Return cached summary if available
		if (appointment.aiPreparedSummary?.content) {
			return res.json({
				success: true,
				data: {
					summary:         appointment.aiPreparedSummary.content,
					editablePoints:  appointment.aiPreparedSummary.editablePoints || [],
					isLocked:        appointment.aiPreparedSummary.isLocked || false,
					sharedWithDoctor: appointment.aiPreparedSummary.sharedWithDoctor || false,
					generatedAt:     appointment.aiPreparedSummary.generatedAt
				}
			});
		}

		// Fetch patient context from MongoDB
		const { PrescriptionModel } = await import('../models/Prescription.js');
		const { LabResultModel }    = await import('../models/LabResult.js');
		const { TranscriptModel }   = await import('../models/Transcript.js');

		const patientId = appointment.patientId._id;
		const [prescriptions, labResults, transcripts] = await Promise.all([
			PrescriptionModel.find({ patientId }).sort({ createdAt: -1 }).limit(5).lean(),
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(5).lean(),
			TranscriptModel.find({ patientId }).sort({ createdAt: -1 }).limit(3).lean()
		]);

		console.log('[AI] Generating AI summary via Ollama (replaces BART)...');
		const briefing = await generatePatientBriefingSummary({
			patientName: appointment.patientId.name,
			reason:      appointment.reason,
			prescriptions,
			labResults,
			transcripts
		});
		console.log('[AI] Summary generation complete.');

		const summaryContent  = briefing.patientOverview || briefing.summary || '';
		const extractedMeds   = (briefing.prescriptions || []).map(p => p.name).filter(Boolean);
		const medicineObjects = extractedMeds.map(name => ({ name, dosage: 'As directed', frequency: 'Check with doctor' }));

		// Notify doctor that the AI brief is ready (fire-and-forget)
		process.nextTick(async () => {
			try {
				const patient = await UserModel.findById(patientId).lean();
				if (patient) {
					await notifyPreConsultReminder(
						appointment.doctorId,
						patient,
						{ _id: id, startTime: appointment.startTime }
					);
				}
			} catch (e) {
				console.warn('[NOTIFY] Pre-consult reminder failed:', e.message);
			}
		});

		// Cache summary + auto-populate medicines in MongoDB
		const updatePayload = {
			$set: {
				'aiPreparedSummary.content':          summaryContent,
				'aiPreparedSummary.editablePoints':   briefing.discussionPoints || [
					'Review abnormal values from recent labs',
					'Check interactions with current medications',
					'Discuss lifestyle changes mentioned in history'
				],
				'aiPreparedSummary.generatedAt':      new Date(),
				'aiPreparedSummary.isLocked':         false,
				'aiPreparedSummary.sharedWithDoctor': false
			}
		};
		if (medicineObjects.length > 0) {
			updatePayload.$set['consultationRecords.medicines'] = medicineObjects;
			console.log(`[AI] Auto-populated ${medicineObjects.length} medicines for pharmacy cart`);
		}
		await AppointmentModel.findByIdAndUpdate(id, updatePayload);

		res.json({
			success: true,
			data: {
				summary:        summaryContent,
				riskLevel:      briefing.riskLevel      || 'unknown',
				conditions:     briefing.conditions     || [],
				concerns:       briefing.concerns       || [],
				labFindings:    briefing.labFindings    || [],
				medsFound:      extractedMeds,
				editablePoints: briefing.discussionPoints || [
					'Review abnormal values from recent labs',
					'Check interactions with current medications',
					'Discuss lifestyle changes mentioned in history'
				],
				isLocked:    false,
				generatedAt: new Date().toISOString(),
				engine:      'ollama'
			}
		});

	} catch (error) {
		console.error('Get AI summary error:', error.message);
		res.status(500).json({ success: false, error: 'AI Engine unavailable. Ensure Ollama is running: ollama serve' });
	}
}

// ─── Update AI Summary Points (PUT) ──────────────────────────────────────────

/**
 * PUT /api/appointments/:id/ai-summary
 * Update the editable discussion points (patient only).
 * Enforces T-10 lock.
 */
export async function updateAiSummary(req, res) {
	try {
		const { id } = req.params;
		const { editablePoints } = req.body;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: patient only
		if (appointment.patientId.toString() !== userId) {
			return res.status(403).json({ success: false, error: 'Only the patient can edit summary points' });
		}

		// T-10 lock enforcement
		const mins = minutesUntil(appointment.appointmentDate, appointment.startTime);
		if (mins <= 10) {
			// Lock the summary and share with doctor
			await AppointmentModel.findByIdAndUpdate(id, {
				$set: {
					'aiPreparedSummary.isLocked': true,
					'aiPreparedSummary.lockedAt': new Date(),
					'aiPreparedSummary.sharedWithDoctor': true
				}
			});
			return res.status(423).json({
				success: false,
				error: 'Summary is locked. It has been shared with your doctor for review.'
			});
		}

		// Update points
		await AppointmentModel.findByIdAndUpdate(id, {
			$set: {
				'aiPreparedSummary.editablePoints': editablePoints || []
			}
		});

		res.json({ success: true, message: 'Summary points updated successfully' });

	} catch (error) {
		console.error('Update AI summary error:', error);
		res.status(500).json({ success: false, error: 'Failed to update summary' });
	}
}

// ─── Upload Consultation Record — see bottom of file for real multer version ─
// (stub removed — real implementation with multer is exported below)

// ─── Complete Consultation (POST) ────────────────────────────────────────────

/**
 * POST /api/appointments/:id/complete
 * Called when the meeting ends. Triggers post-consultation processing:
 * - Save transcript
 * - Generate AI meeting summary
 * - Extract medicines
 * - Update appointment status to 'completed'
 */
export async function completeConsultation(req, res) {
	try {
		const { id } = req.params;
		const { rawText, durationSeconds, hasAudio } = req.body;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id)
			.populate('patientId', 'name')
			.populate('doctorId', 'name')
			.lean();

		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: must be patient or doctor
		if (
			appointment.patientId._id.toString() !== userId &&
			appointment.doctorId._id.toString() !== userId
		) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		// Save transcript
		const { TranscriptModel } = await import('../models/Transcript.js');
		const transcript = await TranscriptModel.findOneAndUpdate(
			{ appointmentId: id },
			{
				$set: {
					patientId: appointment.patientId._id,
					doctorId: appointment.doctorId._id,
					rawText: rawText || '',
					durationSeconds: durationSeconds || 0
				}
			},
			{ upsert: true, new: true }
		);

		// Generate post-consultation summary using Gemini (async — don't block response)
		let meetingSummary = '';
		let medicines = [];

		if (rawText && rawText.length > 20) {
			try {
				const { generatePostConsultationSummary } = await import('../services/ollamaService.js');
				const postResult = await generatePostConsultationSummary({
					transcript: rawText,
					patientName: appointment.patientId.name,
					doctorName: appointment.doctorId.name,
					reason: appointment.reason
				});
				meetingSummary = postResult.meetingSummary || '';
				medicines = postResult.medicines || [];

				// Update transcript with AI summary
				await TranscriptModel.findByIdAndUpdate(transcript._id, {
					$set: { summaryAi: meetingSummary }
				});
			} catch (aiErr) {
				console.error('[AI] Post-consultation summary failed:', aiErr.message);
				meetingSummary = 'AI summary generation in progress. Please check back later.';
			}
		}

		// Update appointment to completed with records
		await AppointmentModel.findByIdAndUpdate(id, {
			$set: {
				status: 'completed',
				lastModifiedBy: userId,
				'consultationRecords.meetingSummary': meetingSummary,
				'consultationRecords.meetingTranscript': rawText || '',
				'consultationRecords.transcriptId': transcript._id,
				'consultationRecords.medicines': medicines
			},
			$push: {
				statusHistory: {
					status: 'completed',
					changedAt: new Date(),
					changedBy: userId,
					reason: 'Meeting ended'
				}
			},
			$inc: { version: 1 }
		});

		res.json({
			success: true,
			message: 'Consultation completed successfully',
			data: {
				appointmentId: id,
				transcriptId: transcript._id,
				hasSummary: !!meetingSummary,
				medicinesExtracted: medicines.length
			}
		});

	} catch (error) {
		console.error('Complete consultation error:', error);
		res.status(500).json({ success: false, error: 'Failed to complete consultation' });
	}
}

// ─── Get Consultation Records (GET) ──────────────────────────────────────────

/**
 * GET /api/appointments/:id/records
 * Fetch full post-consultation records for the records view.
 */
export async function getConsultationRecords(req, res) {
	try {
		const { id } = req.params;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id)
			.populate('consultationRecords.prescriptionId')
			.lean();

		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: must be patient or doctor
		if (
			appointment.patientId.toString() !== userId &&
			appointment.doctorId.toString() !== userId
		) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		res.json({
			success: true,
			data: {
				meetingSummary: appointment.consultationRecords?.meetingSummary || '',
				meetingTranscript: appointment.consultationRecords?.meetingTranscript || '',
				medicines: appointment.consultationRecords?.medicines || [],
				prescriptionImageUrl: appointment.consultationRecords?.prescriptionImageUrl || null,
				prescription: appointment.consultationRecords?.prescriptionId || null,
				linkedRecords: appointment.linkedRecords || [],
				aiPreparedSummary: appointment.aiPreparedSummary?.content || ''
			}
		});

	} catch (error) {
		console.error('Get consultation records error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch consultation records' });
	}
}


// ─── Upload Consultation Record (POST) — FIXED WITH MULTER ──────────────────

/**
 * POST /api/appointments/:id/upload-record
 * Upload a medical record for this specific consultation.
 * Enforces T-15 lock. Uses multer — req.file is populated.
 */
export async function uploadConsultationRecord(req, res) {
	try {
		const { id } = req.params;
		const userId = req.user.userId;

		if (!req.file) {
			return res.status(400).json({ success: false, error: 'No file uploaded' });
		}

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: patient only
		if (appointment.patientId.toString() !== userId) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		// T-15 lock enforcement
		const mins = minutesUntil(appointment.appointmentDate, appointment.startTime);
		if (mins <= 15) {
			// Cleanup uploaded file
			try { await import('fs/promises').then(fs => fs.unlink(req.file.path)); } catch {}
			return res.status(423).json({
				success: false,
				error: 'Uploads are locked 15 minutes before the consultation.'
			});
		}

		// Build file URL
		const UPLOADS_BASE_URL = process.env.UPLOADS_BASE_URL || 'http://localhost:4000/uploads';
		const fileUrl = `${UPLOADS_BASE_URL}/${req.file.filename}`;

		const fileInfo = {
			fileName:   req.file.originalname,
			fileType:   req.file.mimetype,
			fileUrl,
			uploadedAt: new Date()
		};

		await AppointmentModel.findByIdAndUpdate(id, {
			$push: { linkedRecords: fileInfo }
		});

		res.json({
			success: true,
			message: 'Record uploaded successfully',
			data: fileInfo
		});

	} catch (error) {
		console.error('Upload consultation record error:', error);
		// Cleanup file on error
		if (req.file?.path) {
			try { await import('fs/promises').then(fs => fs.unlink(req.file.path)); } catch {}
		}
		res.status(500).json({ success: false, error: 'Failed to upload record' });
	}
}

// ─── Get Patient Queries (GET) ───────────────────────────────────────────────

/**
 * GET /api/appointments/:id/patient-queries
 * Fetch all escalated chatbot queries for this consultation.
 * Doctor only.
 */
export async function getPatientQueries(req, res) {
	try {
		const { id } = req.params;
		const userId = req.user.userId;

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: doctor only
		if (appointment.doctorId.toString() !== userId) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		const { PatientQueryModel } = await import('../models/PatientQuery.js');
		const queries = await PatientQueryModel.find({ appointmentId: id })
			.sort({ escalatedAt: -1 })
			.lean();

		res.json({
			success: true,
			data: queries.map(q => ({
				_id:            q._id,
				question:       q.question,
				doctorResponse: q.doctorResponse,
				respondedAt:    q.respondedAt,
				escalatedAt:    q.escalatedAt,
				status:         q.status
			}))
		});

	} catch (error) {
		console.error('Get patient queries error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch patient queries' });
	}
}

// ─── Respond to Patient Query (POST) ─────────────────────────────────────────

/**
 * POST /api/appointments/:id/patient-queries/:queryId/respond
 * Doctor responds to an escalated patient query.
 * Body: { response }
 */
export async function respondToPatientQuery(req, res) {
	try {
		const { id, queryId } = req.params;
		const { response } = req.body;
		const userId = req.user.userId;

		if (!response?.trim()) {
			return res.status(400).json({ success: false, error: 'Response is required' });
		}

		const appointment = await AppointmentModel.findById(id).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: 'Appointment not found' });
		}

		// Auth: doctor only
		if (appointment.doctorId.toString() !== userId) {
			return res.status(403).json({ success: false, error: 'Unauthorized' });
		}

		const { PatientQueryModel } = await import('../models/PatientQuery.js');
		const query = await PatientQueryModel.findOneAndUpdate(
			{ _id: queryId, appointmentId: id },
			{
				$set: {
					doctorResponse: response.trim(),
					respondedAt:    new Date(),
					status:         'answered'
				}
			},
			{ new: true }
		);

		if (!query) {
			return res.status(404).json({ success: false, error: 'Query not found' });
		}

		res.json({
			success: true,
			message: 'Response sent successfully',
			data: {
				queryId:        query._id,
				doctorResponse: query.doctorResponse,
				respondedAt:    query.respondedAt
			}
		});

	} catch (error) {
		console.error('Respond to patient query error:', error);
		res.status(500).json({ success: false, error: 'Failed to send response' });
	}
}
