/**
 * Chatbot Controller — MedHub AI+
 * RAG-based chatbot using patient's medical records as context.
 * Escalation pathway to Doctor dashboard.
 */

import { TranscriptModel }    from "../models/Transcript.js";
import { LabResultModel }     from "../models/LabResult.js";
import { PrescriptionModel }  from "../models/Prescription.js";
import { AppointmentModel }   from "../models/Appointment.js";
import { generateChatbotResponse } from "../services/ollamaService.js";
import { notifyEmergencyEscalation } from "../services/notificationService.js";

// ─── Ask Chatbot (General) ────────────────────────────────────────────────────

/**
 * POST /api/chatbot/ask
 * RAG chatbot using patient's full medical history as context.
 * Body: { message }
 */
export async function askChatbot(req, res) {
	try {
		const { message } = req.body;
		const patientId   = req.user.userId;

		if (!message?.trim()) {
			return res.status(400).json({ success: false, error: "Message is required." });
		}

		const [transcripts, labResults, prescriptions] = await Promise.all([
			TranscriptModel.find({ patientId }).sort({ createdAt: -1 }).limit(3).lean(),
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(3).lean(),
			PrescriptionModel.find({ patientId, status: "active" }).sort({ createdAt: -1 }).limit(3).lean()
		]);

		let context = "";

		if (transcripts.length > 0) {
			context += "=== CONSULTATION TRANSCRIPTS ===\n";
			transcripts.forEach((t, i) => {
				context += `--- Session ${i + 1} (${t.createdAt?.toISOString().split("T")[0]}) ---\n`;
				context += t.rawText?.substring(0, 600) + "\n\n";
			});
		}

		if (labResults.length > 0) {
			context += "=== RECENT LAB RESULTS ===\n";
			labResults.forEach((lr, i) => {
				context += `--- Report ${i + 1}: ${lr.fileName} (${lr.recordDate?.toISOString().split("T")[0]}) ---\n`;
				lr.structuredData.slice(0, 10).forEach(t =>
					context += `  ${t.testName}: ${t.value}${t.unit || ""} [${t.flag}]\n`
				);
				context += "\n";
			});
		}

		if (prescriptions.length > 0) {
			context += "=== ACTIVE PRESCRIPTIONS ===\n";
			prescriptions.forEach((p, i) => {
				context += `--- Prescription ${i + 1} (${p.createdAt?.toISOString().split("T")[0]}) ---\n`;
				p.medicines.forEach(m =>
					context += `  ${m.name} ${m.dosage} – ${m.frequency}\n`
				);
				context += "\n";
			});
		}

		if (!context) context = "No history available.";

		// ── Generate Response ───────────────────────────────────────────────────────────────────
		const response = await generateChatbotResponse({ userMessage: message, context });
		res.json({ success: true, data: { ...response, canEscalate: true } });

	} catch (error) {
		console.error("Chatbot ask error:", error.message);
		res.status(500).json({ success: false, error: "Chatbot is unavailable. Please try again in a moment." });
	}
}

// ─── Escalate to Doctor ───────────────────────────────────────────────────────

/**
 * POST /api/chatbot/escalate
 * Body: { appointmentId?, question, aiAnswer? }
 */
export async function escalateToDoctor(req, res) {
	try {
		const patientId = req.user.userId;
		const { appointmentId, question, aiAnswer } = req.body;

		let appointment;
		if (appointmentId) {
			appointment = await AppointmentModel.findById(appointmentId);
		} else {
			appointment = await AppointmentModel.findOne({
				patientId,
				status: { $in: ["pending", "confirmed", "in_progress", "completed"] }
			}).sort({ appointmentDate: -1 });
		}

		if (!appointment) {
			return res.status(404).json({
				success: false,
				error: "No appointment found. Please contact the clinic directly."
			});
		}

		const { PatientQueryModel } = await import('../models/PatientQuery.js');
		const savedQuery = await PatientQueryModel.create({
			appointmentId:    appointment._id,
			patientId,
			doctorId:         appointment.doctorId,
			question:         question?.trim() || 'Patient escalated a query from the AI chatbot.',
			aiProvidedAnswer: aiAnswer?.trim() || '',
			status:           'pending',
			escalatedAt:      new Date()
		});

		// Mark on appointment
		appointment.emergencyEscalated   = true;
		appointment.emergencyEscalatedAt = new Date();
		await appointment.save();

		// Notify doctor
		await appointment.populate({ path: "patientId", select: "name" });
		await notifyEmergencyEscalation(
			appointment.doctorId.toString(),
			appointment.patientId?.name || "A patient",
			appointment._id
		);

		console.log(`[CHATBOT] Escalated: patient ${patientId} → doctor ${appointment.doctorId}`);

		res.json({
			success: true,
			message: "Your question has been sent to the doctor.",
			data: {
				appointmentId:  appointment._id,
				queryId:        savedQuery._id,
				escalatedAt:    savedQuery.escalatedAt,
				doctorNotified: true
			}
		});

	} catch (error) {
		console.error("Escalate error:", error.message);
		res.status(500).json({ success: false, error: "Failed to send escalation." });
	}
}

// ─── Consultation-Scoped Chatbot ──────────────────────────────────────────────

/**
 * POST /api/chatbot/ask-consultation
 * Post-consultation RAG chatbot scoped to a specific meeting's records.
 * Context priority: meetingSummary → transcript → medicines → lab history
 * Body: { message, appointmentId }
 */
export async function askConsultationChatbot(req, res) {
	try {
		const { message, appointmentId } = req.body;
		const patientId = req.user.userId;

		if (!message?.trim()) {
			return res.status(400).json({ success: false, error: "Message is required." });
		}
		if (!appointmentId) {
			return res.status(400).json({ success: false, error: "appointmentId is required." });
		}

		const appointment = await AppointmentModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: "Appointment not found." });
		}

		if (appointment.patientId.toString() !== patientId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		let context = "";

		// 1. Consultation date + reason
		context += `=== CONSULTATION INFO ===\nDate: ${appointment.appointmentDate?.toISOString().split('T')[0]}\nReason: ${appointment.reason}\n\n`;

		// 2. Doctor's meeting summary (highest priority)
		if (appointment.consultationRecords?.meetingSummary) {
			context += "=== DOCTOR'S MEETING SUMMARY ===\n";
			context += appointment.consultationRecords.meetingSummary.substring(0, 1000) + "\n\n";
		}

		// 3. Full meeting transcript
		if (appointment.consultationRecords?.meetingTranscript) {
			context += "=== MEETING TRANSCRIPT ===\n";
			context += appointment.consultationRecords.meetingTranscript.substring(0, 1500) + "\n\n";
		}

		// 4. Prescribed medicines from this consultation
		if (appointment.consultationRecords?.medicines?.length > 0) {
			context += "=== PRESCRIBED MEDICINES ===\n";
			appointment.consultationRecords.medicines.forEach(m => {
				context += `- ${m.name} ${m.dosage} – ${m.frequency} (${m.duration || 'as directed'})\n`;
			});
			context += "\n";
		}

		// 5. AI transcript summary from TranscriptModel
		const transcript = await TranscriptModel.findOne({ appointmentId }).lean();
		if (transcript?.summaryAi) {
			context += "=== AI TRANSCRIPT SUMMARY ===\n";
			context += transcript.summaryAi.substring(0, 600) + "\n\n";
		} else if (transcript?.rawText && !appointment.consultationRecords?.meetingTranscript) {
			context += "=== CONSULTATION TRANSCRIPT ===\n";
			context += transcript.rawText.substring(0, 1000) + "\n\n";
		}

		// 6. Pre-consultation AI briefing
		if (appointment.aiPreparedSummary?.content) {
			context += "=== PRE-CONSULTATION BRIEFING ===\n";
			context += appointment.aiPreparedSummary.content.substring(0, 600) + "\n\n";
		}

		// 7. Patient's broader medical history
		const [labResults, prescriptions] = await Promise.all([
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(2).lean(),
			PrescriptionModel.find({ patientId, status: "active" }).sort({ createdAt: -1 }).limit(2).lean()
		]);

		if (labResults.length > 0) {
			context += "=== PATIENT LAB HISTORY ===\n";
			labResults.forEach(lr => {
				context += `--- ${lr.fileName} (${lr.recordDate?.toISOString().split("T")[0]}) ---\n`;
				lr.structuredData.slice(0, 6).forEach(t =>
					context += `  ${t.testName}: ${t.value}${t.unit || ""} [${t.flag}]\n`
				);
			});
			context += "\n";
		}

		if (prescriptions.length > 0) {
			context += "=== OTHER ACTIVE PRESCRIPTIONS ===\n";
			prescriptions.forEach(p => {
				p.medicines.forEach(m =>
					context += `  ${m.name} ${m.dosage} – ${m.frequency}\n`
				);
			});
		}

		if (!context.includes("MEETING") && !context.includes("TRANSCRIPT")) {
			return res.json({
				success: true,
				data: {
					answer:      "I don't have any records for this consultation yet. If the meeting has ended, the records may still be processing.",
					disclaimer:  "⚕️ This AI assistant is for informational purposes only.",
					canEscalate: true
				}
			});
		}

		const response = await generateChatbotResponse({ userMessage: message, context });
		res.json({ success: true, data: { ...response, canEscalate: true } });

	} catch (error) {
		console.error("Consultation chatbot error:", error.message);
		res.status(500).json({ success: false, error: "Chatbot unavailable. Please try again." });
	}
}
