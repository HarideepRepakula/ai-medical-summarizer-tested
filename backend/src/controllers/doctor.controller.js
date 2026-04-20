import { DoctorModel }       from "../models/Doctor.js";
import { UserModel }         from "../models/User.js";
import { PatientQueryModel } from "../models/PatientQuery.js";

const SPECIALTIES = [
	'Cardiology', 'Dermatology', 'General Physician', 'Pediatrics',
	'Neurology', 'Orthopedics', 'Psychiatry', 'Gynecology', 'ENT', 'Ophthalmology'
];

// ─── Get Doctors (Verified Only + Specialty/Search Filter) ───────────────────

export async function getDoctors(req, res) {
	try {
		const { specialty, search } = req.query;

		// Only show AI-verified doctors to patients
		const filter = { isVerified: true };

		if (specialty && specialty !== 'All') {
			filter.specialty = specialty;
		}

		const doctors = await DoctorModel.find(filter)
			.populate('userId', 'name email phone')
			.sort({ rating: -1 });

		let formatted = doctors.map(doctor => ({
			id:              doctor._id,
			name:            doctor.userId.name,
			email:           doctor.userId.email,
			phone:           doctor.userId.phone,
			specialty:       doctor.specialty,
			experience:      doctor.experience,
			rating:          doctor.rating,
			consultationFee: doctor.consultationFee,
			isVerified:      doctor.isVerified,
			image:           doctor.image || `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face`,
			availability:    doctor.availability
		}));

		// Client-side name search (after populate)
		if (search) {
			const re = new RegExp(search, 'i');
			formatted = formatted.filter(d => re.test(d.name));
		}

		res.json({ doctors: formatted, specialties: SPECIALTIES });
	} catch (error) {
		console.error('Get doctors error:', error);
		res.status(500).json({ error: 'Failed to fetch doctors' });
	}
}

// ─── Get Doctor By ID ─────────────────────────────────────────────────────────

export async function getDoctorById(req, res) {
	try {
		const doctor = await DoctorModel.findById(req.params.id)
			.populate('userId', 'name email phone');

		if (!doctor) {
			return res.status(404).json({ error: 'Doctor not found' });
		}

		res.json({
			doctor: {
				id:              doctor._id,
				name:            doctor.userId.name,
				email:           doctor.userId.email,
				phone:           doctor.userId.phone,
				specialty:       doctor.specialty,
				experience:      doctor.experience,
				rating:          doctor.rating,
				consultationFee: doctor.consultationFee,
				isVerified:      doctor.isVerified,
				verificationStatus: doctor.verificationStatus,
				image:           doctor.image || `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face`,
				availability:    doctor.availability
			}
		});
	} catch (error) {
		console.error('Get doctor error:', error);
		res.status(500).json({ error: 'Failed to fetch doctor' });
	}
}

// ─── Doctor: Escalated Patient Queries Dashboard ─────────────────────────────

/**
 * GET /api/doctors/escalated-queries
 * Returns all pending patient queries escalated from the RAG chatbot.
 * Doctor only.
 */
export async function getEscalatedQueries(req, res) {
	try {
		const doctorId = req.user.userId;

		const queries = await PatientQueryModel.find({ doctorId, status: 'pending' })
			.populate('patientId',    'name email phone')
			.populate('appointmentId', 'appointmentDate reason startTime')
			.sort({ escalatedAt: -1 })
			.lean();

		res.json({
			success: true,
			data: {
				count:   queries.length,
				queries: queries.map(q => ({
					queryId:         q._id,
					question:        q.question,
					aiProvidedAnswer: q.aiProvidedAnswer || '',
					patient:         { name: q.patientId?.name, email: q.patientId?.email },
					appointment:     {
						id:     q.appointmentId?._id,
						date:   q.appointmentId?.appointmentDate,
						time:   q.appointmentId?.startTime,
						reason: q.appointmentId?.reason
					},
					escalatedAt: q.escalatedAt,
					status:      q.status
				}))
			}
		});
	} catch (error) {
		console.error('Get escalated queries error:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch queries' });
	}
}

// ─── Doctor: Respond to Escalated Query ──────────────────────────────────────

/**
 * POST /api/doctors/escalated-queries/:queryId/respond
 * Body: { response }
 */
export async function respondToEscalatedQuery(req, res) {
	try {
		const { queryId }  = req.params;
		const { response } = req.body;
		const doctorId     = req.user.userId;

		if (!response?.trim()) {
			return res.status(400).json({ success: false, error: 'Response is required' });
		}

		const query = await PatientQueryModel.findOneAndUpdate(
			{ _id: queryId, doctorId },
			{ $set: { doctorResponse: response.trim(), respondedAt: new Date(), status: 'answered' } },
			{ new: true }
		);

		if (!query) {
			return res.status(404).json({ success: false, error: 'Query not found' });
		}

		res.json({ success: true, message: 'Response sent to patient.' });
	} catch (error) {
		console.error('Respond to query error:', error);
		res.status(500).json({ success: false, error: 'Failed to send response' });
	}
}
