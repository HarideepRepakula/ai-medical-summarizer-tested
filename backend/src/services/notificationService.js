/**
 * Notification Service — MedHub AI+
 *
 * Currently implemented as structured stubs that log to console.
 * To activate real delivery:
 *   - Email:  Install nodemailer (`npm i nodemailer`) and fill sendEmail()
 *   - SMS:    Install twilio (`npm i twilio`) and fill sendSMS()
 *
 * Each function creates a Notification document in MongoDB for in-app history.
 */

import { NotificationModel } from "../models/Notification.js";

// ─── Internal Transports (swap these for real providers) ──────────────────────

async function sendEmail({ to, subject, body }) {
	// TODO: Replace with Nodemailer
	// const transporter = nodemailer.createTransport({ ... });
	// await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html: body });
	console.log(`📧 [EMAIL STUB] To: ${to} | Subject: ${subject}`);
	console.log(`   Body: ${body.substring(0, 120)}...`);
}

async function sendSMS({ to, message }) {
	// TODO: Replace with Twilio
	// const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
	// await client.messages.create({ to, from: process.env.TWILIO_PHONE, body: message });
	console.log(`📱 [SMS STUB] To: ${to} | Message: ${message.substring(0, 100)}`);
}

// ─── Persist in-app notification ─────────────────────────────────────────────

async function persist(userId, event, title, message, metadata = {}) {
	try {
		await NotificationModel.create({
			userId,
			event,
			channel: "in-app",
			type: getEventType(event),
			title,
			message,
			metadata,
			status: "sent"
		});
	} catch (err) {
		console.error("[NOTIFICATION] Failed to persist:", err.message);
	}
}

function getEventType(event) {
	const map = {
		booking_confirmed:         "success",
		appointment_cancelled:     "warning",
		appointment_rescheduled:   "info",
		prescription_ready:        "success",
		pharmacy_order_update:     "info",
		emergency_escalation:      "error",
		lab_result_uploaded:       "info",
		pre_consult_reminder:      "info"
	};
	return map[event] || "info";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Booking Confirmation
 * Triggered when a patient books a new appointment.
 * Sends: Email → Patient
 */
export async function notifyBookingConfirmed(patient, appointment) {
	const subject = "Appointment Confirmed — MedHub";
	const body = `
		<h2>Your appointment is confirmed!</h2>
		<p>Dear ${patient.name},</p>
		<p>Your appointment with <strong>${appointment.doctorName}</strong> is scheduled for:</p>
		<ul>
			<li><strong>Date:</strong> ${appointment.date}</li>
			<li><strong>Time:</strong> ${appointment.startTime} – ${appointment.endTime}</li>
			<li><strong>Reason:</strong> ${appointment.reason}</li>
		</ul>
		<p>You can view or manage this appointment in your dashboard.</p>
		<hr/>
		<p><em>MedHub AI+ | Your Health, Our Priority</em></p>
	`;

	await sendEmail({ to: patient.email, subject, body });
	await persist(
		patient._id,
		"booking_confirmed",
		"Appointment Confirmed",
		`Your appointment with ${appointment.doctorName} on ${appointment.date} at ${appointment.startTime} is confirmed.`,
		{ appointmentId: appointment._id }
	);

	console.log(`[NOTIFICATION] Booking confirmed → patient ${patient._id}`);
}

/**
 * Doctor-Initiated Reschedule
 * Triggered when a doctor reschedules the patient's appointment.
 * Sends: Email + SMS → Patient
 */
export async function notifyDoctorReschedule(patient, oldAppointment, newAppointment) {
	const subject = "Your Appointment Has Been Rescheduled — MedHub";
	const body = `
		<h2>Appointment Rescheduled</h2>
		<p>Dear ${patient.name},</p>
		<p>Your appointment with <strong>${oldAppointment.doctorName}</strong> has been rescheduled.</p>
		<table>
			<tr><th>Previously</th><th>New Time</th></tr>
			<tr><td>${oldAppointment.date} at ${oldAppointment.startTime}</td>
			    <td>${newAppointment.date} at ${newAppointment.startTime}</td></tr>
		</table>
		<p>If this doesn't work for you, please log in to reschedule or cancel.</p>
		<hr/>
		<p><em>MedHub AI+ | Your Health, Our Priority</em></p>
	`;

	const smsMessage = `MedHub: Your appt with ${oldAppointment.doctorName} was rescheduled to ${newAppointment.date} at ${newAppointment.startTime}. Login to manage.`;

	await Promise.all([
		sendEmail({ to: patient.email, subject, body }),
		patient.phone ? sendSMS({ to: patient.phone, message: smsMessage }) : Promise.resolve()
	]);

	await persist(
		patient._id,
		"appointment_rescheduled",
		"Appointment Rescheduled",
		`Your appointment has been moved to ${newAppointment.date} at ${newAppointment.startTime}.`,
		{ oldAppointmentId: oldAppointment._id, newAppointmentId: newAppointment._id }
	);

	console.log(`[NOTIFICATION] Doctor reschedule → patient ${patient._id}`);
}

/**
 * Cancellation Notice
 * Triggered when an appointment is cancelled by either party.
 * Sends: Email → Patient
 */
export async function notifyCancellation(patient, appointment, cancelledBy) {
	const subject = "Appointment Cancelled — MedHub";
	const body = `
		<h2>Appointment Cancelled</h2>
		<p>Dear ${patient.name},</p>
		<p>Your appointment with <strong>${appointment.doctorName}</strong> scheduled for ${appointment.date} at ${appointment.startTime} has been cancelled.</p>
		<p>Cancelled by: <strong>${cancelledBy}</strong></p>
		<p>Please log in to book a new appointment if needed.</p>
		<hr/>
		<p><em>MedHub AI+ | Your Health, Our Priority</em></p>
	`;

	await sendEmail({ to: patient.email, subject, body });
	await persist(
		patient._id,
		"appointment_cancelled",
		"Appointment Cancelled",
		`Your appointment with ${appointment.doctorName} on ${appointment.date} was cancelled.`,
		{ appointmentId: appointment._id }
	);
}

/**
 * Pre-Consultation Reminder (10-minute alert)
 * Triggered by a scheduler or polling mechanism.
 * Sends: In-app → Doctor
 */
export async function notifyPreConsultReminder(doctorId, patient, appointment) {
	await persist(
		doctorId,
		"pre_consult_reminder",
		"🔔 Consultation in 10 minutes",
		`Upcoming: ${patient.name} at ${appointment.startTime}. AI summary is now available.`,
		{ appointmentId: appointment._id, patientId: patient._id }
	);
}

/**
 * Emergency Escalation (RAG chatbot → doctor)
 * Triggered when patient clicks "Talk to Doctor" in chatbot.
 * Sends: In-app → Doctor
 */
export async function notifyEmergencyEscalation(doctorId, patientName, appointmentId) {
	await persist(
		doctorId,
		"emergency_escalation",
		"🚨 Emergency – Patient Needs Immediate Attention",
		`${patientName} has flagged an emergency via the AI chatbot. Please review immediately.`,
		{ appointmentId }
	);
	console.log(`[NOTIFICATION] Emergency escalation → doctor ${doctorId}`);
}

/**
 * Get unread in-app notifications for a user
 */
export async function getUnreadNotifications(userId, limit = 20) {
	return NotificationModel.find({
		userId,
		channel: "in-app",
		status: { $ne: "read" }
	})
		.sort({ createdAt: -1 })
		.limit(limit)
		.lean();
}

/**
 * Mark notification(s) as read
 */
export async function markNotificationsRead(userId, notificationIds) {
	return NotificationModel.updateMany(
		{ _id: { $in: notificationIds }, userId },
		{ status: "read", readAt: new Date() }
	);
}
