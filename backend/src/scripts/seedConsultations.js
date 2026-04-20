/**
 * Seed Script — Insert 4 sample appointments with full consultation data
 * 
 * Run: node src/scripts/seedConsultations.js
 * 
 * Creates:
 *  - 2 Doctors (User + Doctor profile)
 *  - 1 Patient (User)
 *  - 4 Appointments:
 *    1. Upcoming (confirmed, 2 hours from now)
 *    2. Upcoming (pending, tomorrow)
 *    3. Completed (with transcript, summary, medicines)
 *    4. Completed (with transcript, summary, linked records)
 *  - 2 Prescriptions (for completed appointments)
 *  - 2 Transcripts (for completed appointments)
 *  - 2 Lab Results (for patient history)
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medhub';

// ── Models ───────────────────────────────────────────────────────────────────
import { UserModel } from '../models/User.js';
import { DoctorModel } from '../models/Doctor.js';
import { AppointmentModel } from '../models/Appointment.js';
import { PrescriptionModel } from '../models/Prescription.js';
import { TranscriptModel } from '../models/Transcript.js';
import { LabResultModel } from '../models/LabResult.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function hoursFromNow(hours) {
	const d = new Date();
	d.setHours(d.getHours() + hours);
	return d;
}

function formatTime(date) {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(timeStr, minutes) {
	const [h, m] = timeStr.split(':').map(Number);
	const totalMin = h * 60 + m + minutes;
	return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

function dateOnly(d) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function seed() {
	console.log('🌱 Connecting to MongoDB...');
	await mongoose.connect(MONGO_URI);
	console.log('✅ Connected to', MONGO_URI);

	// ── Clean existing seed data ─────────────────────────────────────────
	console.log('🧹 Cleaning existing seed data...');
	const seedEmails = [
		'patient.demo@cliniq.ai',
		'dr.sarah.demo@cliniq.ai',
		'dr.chen.demo@cliniq.ai'
	];
	const existingUsers = await UserModel.find({ email: { $in: seedEmails } }).select('_id');
	const existingIds = existingUsers.map(u => u._id);

	if (existingIds.length > 0) {
		await AppointmentModel.deleteMany({ $or: [{ patientId: { $in: existingIds } }, { doctorId: { $in: existingIds } }] });
		await PrescriptionModel.deleteMany({ $or: [{ patientId: { $in: existingIds } }, { doctorId: { $in: existingIds } }] });
		await TranscriptModel.deleteMany({ $or: [{ patientId: { $in: existingIds } }, { doctorId: { $in: existingIds } }] });
		await LabResultModel.deleteMany({ patientId: { $in: existingIds } });
		await DoctorModel.deleteMany({ userId: { $in: existingIds } });
		await UserModel.deleteMany({ _id: { $in: existingIds } });
	}

	// ── Create Users ─────────────────────────────────────────────────────
	console.log('👤 Creating users...');
	const passwordHash = await bcrypt.hash('Demo@123', 12);

	const patient = await UserModel.create({
		name: 'Rahul Sharma',
		phone: '+91-9900001111',
		email: 'patient.demo@cliniq.ai',
		passwordHash,
		role: 'PATIENT'
	});

	const doctorUser1 = await UserModel.create({
		name: 'Dr. Sarah Johnson',
		phone: '+91-9900002222',
		email: 'dr.sarah.demo@cliniq.ai',
		passwordHash,
		role: 'DOCTOR'
	});

	const doctorUser2 = await UserModel.create({
		name: 'Dr. Michael Chen',
		phone: '+91-9900003333',
		email: 'dr.chen.demo@cliniq.ai',
		passwordHash,
		role: 'DOCTOR'
	});

	// ── Create Doctor Profiles ───────────────────────────────────────────
	console.log('🩺 Creating doctor profiles...');
	const doctor1 = await DoctorModel.create({
		userId: doctorUser1._id,
		specialty: 'Cardiology',
		experience: '15+ years',
		rating: 4.9,
		consultationFee: 2000,
		availability: [
			{ day: 'Monday', startTime: '09:00', endTime: '17:00' },
			{ day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
			{ day: 'Friday', startTime: '09:00', endTime: '17:00' }
		]
	});

	const doctor2 = await DoctorModel.create({
		userId: doctorUser2._id,
		specialty: 'Dermatology',
		experience: '10+ years',
		rating: 4.8,
		consultationFee: 1800,
		availability: [
			{ day: 'Tuesday', startTime: '10:00', endTime: '18:00' },
			{ day: 'Thursday', startTime: '10:00', endTime: '18:00' },
			{ day: 'Saturday', startTime: '10:00', endTime: '14:00' }
		]
	});

	// ── Create Lab Results (patient history) ─────────────────────────────
	console.log('🔬 Creating lab results...');
	const labResult1 = await LabResultModel.create({
		patientId: patient._id,
		uploadedBy: patient._id,
		rawOcrText: 'Complete Blood Count Report\nHemoglobin: 14.2 g/dL\nWBC: 7500 /cumm\nPlatelets: 250000 /cumm\nRBC: 5.1 million/cumm\nFasting Glucose: 112 mg/dL\nHbA1c: 6.1%\nTotal Cholesterol: 215 mg/dL\nLDL: 140 mg/dL\nHDL: 45 mg/dL\nTriglycerides: 180 mg/dL',
		structuredData: [
			{ testName: 'Hemoglobin', value: '14.2', numericValue: 14.2, unit: 'g/dL', referenceRange: '13.0-17.0', flag: 'normal' },
			{ testName: 'WBC', value: '7500', numericValue: 7500, unit: '/cumm', referenceRange: '4000-11000', flag: 'normal' },
			{ testName: 'Fasting Glucose', value: '112', numericValue: 112, unit: 'mg/dL', referenceRange: '70-100', flag: 'high' },
			{ testName: 'HbA1c', value: '6.1', numericValue: 6.1, unit: '%', referenceRange: '4.0-5.6', flag: 'high' },
			{ testName: 'Total Cholesterol', value: '215', numericValue: 215, unit: 'mg/dL', referenceRange: '<200', flag: 'high' },
			{ testName: 'LDL', value: '140', numericValue: 140, unit: 'mg/dL', referenceRange: '<100', flag: 'high' },
			{ testName: 'HDL', value: '45', numericValue: 45, unit: 'mg/dL', referenceRange: '>40', flag: 'normal' },
			{ testName: 'Triglycerides', value: '180', numericValue: 180, unit: 'mg/dL', referenceRange: '<150', flag: 'high' }
		],
		fileName: 'CBC_Lipid_Report_Jan2024.pdf',
		fileType: 'pdf',
		recordDate: new Date('2024-01-10'),
		labName: 'Metropolis Healthcare',
		doctorOrdered: 'Dr. Sarah Johnson'
	});

	const labResult2 = await LabResultModel.create({
		patientId: patient._id,
		uploadedBy: patient._id,
		rawOcrText: 'Thyroid Panel\nTSH: 3.2 mIU/L\nT3: 1.2 ng/mL\nT4: 8.5 mcg/dL\nCreatinine: 1.0 mg/dL\neGFR: 90 mL/min',
		structuredData: [
			{ testName: 'TSH', value: '3.2', numericValue: 3.2, unit: 'mIU/L', referenceRange: '0.4-4.0', flag: 'normal' },
			{ testName: 'T3', value: '1.2', numericValue: 1.2, unit: 'ng/mL', referenceRange: '0.8-2.0', flag: 'normal' },
			{ testName: 'T4', value: '8.5', numericValue: 8.5, unit: 'mcg/dL', referenceRange: '4.5-12.0', flag: 'normal' },
			{ testName: 'Creatinine', value: '1.0', numericValue: 1.0, unit: 'mg/dL', referenceRange: '0.7-1.3', flag: 'normal' },
			{ testName: 'eGFR', value: '90', numericValue: 90, unit: 'mL/min', referenceRange: '>60', flag: 'normal' }
		],
		fileName: 'Thyroid_Kidney_Panel_Dec2023.pdf',
		fileType: 'pdf',
		recordDate: new Date('2023-12-15'),
		labName: 'SRL Diagnostics',
		doctorOrdered: 'Dr. Michael Chen'
	});

	// ── Appointment 1: Upcoming (tomorrow morning, confirmed) ───────────
	console.log('📅 Creating appointments...');
	const apt1Date = new Date();
	apt1Date.setDate(apt1Date.getDate() + 1); // Tomorrow

	const appointment1 = await AppointmentModel.create({
		patientId: patient._id,
		doctorId: doctorUser1._id,
		appointmentDate: dateOnly(apt1Date),
		startTime: '10:00',
		endTime: '10:30',
		durationMinutes: 30,
		reason: 'Follow-up on cholesterol levels and medication review',
		notes: 'Patient reported mild headaches last week. Check BP and lipid panel.',
		urgency: 'normal',
		status: 'confirmed',
		fee: 2000,
		paymentStatus: 'paid',
		createdBy: patient._id,
		timezone: 'Asia/Kolkata',
		aiPreparedSummary: {
			content: 'Patient Rahul Sharma (35M) presents for cholesterol follow-up. Most recent lipid panel (Jan 2024) shows elevated Total Cholesterol (215 mg/dL), LDL (140 mg/dL), and Triglycerides (180 mg/dL). Fasting glucose is borderline at 112 mg/dL with HbA1c of 6.1%, indicating pre-diabetic status. Currently on Atorvastatin 20mg and Metformin 500mg. Thyroid and renal function remain normal.',
			editablePoints: [
				'Review latest lipid panel — LDL still elevated at 140',
				'Discuss Atorvastatin dosage adjustment (currently 20mg)',
				'Pre-diabetic status: HbA1c 6.1% — lifestyle vs medication',
				'Ask about diet changes and exercise routine',
				'Mild headaches reported — check blood pressure'
			],
			isLocked: false,
			sharedWithDoctor: false,
			generatedAt: new Date()
		},
		linkedRecords: [
			{
				fileUrl: '#lipid-panel-jan2024',
				fileName: 'CBC_Lipid_Report_Jan2024.pdf',
				uploadedAt: new Date(Date.now() - 86400000),
				fileType: 'pdf'
			}
		]
	});

	// ── Appointment 2: Upcoming (day after tomorrow, pending) ───────────
	const apt2Date = new Date();
	apt2Date.setDate(apt2Date.getDate() + 2);

	const appointment2 = await AppointmentModel.create({
		patientId: patient._id,
		doctorId: doctorUser2._id,
		appointmentDate: dateOnly(apt2Date),
		startTime: '14:30',
		endTime: '15:00',
		durationMinutes: 30,
		reason: 'Skin rash on forearms — persisting for 2 weeks',
		notes: 'New patient consultation. Possible allergic dermatitis.',
		urgency: 'normal',
		status: 'pending',
		fee: 1800,
		paymentStatus: 'pending',
		createdBy: patient._id,
		timezone: 'Asia/Kolkata',
		aiPreparedSummary: {
			content: 'Patient Rahul Sharma (35M) presents with a persistent skin rash on forearms for 2 weeks. No prior dermatology consultations on record. Medical history includes pre-diabetic status and elevated cholesterol. Currently on Atorvastatin and Metformin. Thyroid and renal panels are normal. No known drug allergies documented.',
			editablePoints: [
				'Describe rash: location, color, itchiness, triggers',
				'Any new medications, detergents, or food changes?',
				'Family history of eczema or psoriasis',
				'Ask about Metformin — can cause skin reactions in rare cases'
			],
			isLocked: false,
			sharedWithDoctor: false,
			generatedAt: new Date()
		}
	});

	// ── Appointment 3: Completed (with full records) ─────────────────────
	const pastDate1 = new Date();
	pastDate1.setDate(pastDate1.getDate() - 7);

	const appointment3 = await AppointmentModel.create({
		patientId: patient._id,
		doctorId: doctorUser1._id,
		appointmentDate: dateOnly(pastDate1),
		startTime: '10:00',
		endTime: '10:30',
		durationMinutes: 30,
		reason: 'Routine cardiac check-up and ECG review',
		notes: 'Annual heart health review.',
		urgency: 'normal',
		status: 'completed',
		fee: 2000,
		paymentStatus: 'paid',
		createdBy: patient._id,
		timezone: 'Asia/Kolkata',
		aiPreparedSummary: {
			content: 'Pre-consultation summary was generated and shared with the doctor before the appointment.',
			editablePoints: ['Cardiac health review', 'ECG results discussion', 'Exercise tolerance assessment'],
			isLocked: true,
			sharedWithDoctor: true,
			lockedAt: pastDate1,
			generatedAt: new Date(pastDate1.getTime() - 3600000)
		},
		consultationRecords: {
			meetingSummary: 'Patient Rahul Sharma presented for a routine cardiac check-up. ECG showed normal sinus rhythm with no significant abnormalities. Blood pressure was 128/82 mmHg — slightly elevated but within acceptable range. Heart rate at 74 bpm. Patient reports occasional palpitations during exercise, which the doctor attributed to deconditioning rather than cardiac pathology. Cholesterol management was discussed — current Atorvastatin 20mg appears insufficient. Doctor recommended increasing to 40mg and adding a low-dose aspirin (75mg daily). Follow-up lipid panel in 3 months. Advised 30 minutes of brisk walking daily and a Mediterranean-style diet.',
			meetingTranscript: `Dr. Johnson: Good morning Rahul, how have you been feeling?
Patient: Good morning doctor. Generally okay, but I've been getting occasional palpitations when I exercise.
Dr. Johnson: How often does that happen? And what kind of exercise?
Patient: Maybe twice a week. Usually when I jog or climb stairs quickly.
Dr. Johnson: I see. Let me check your ECG results... Your ECG shows normal sinus rhythm, which is good. The palpitations are likely due to deconditioning rather than any cardiac issue. Your blood pressure today is 128/82 — slightly elevated but not alarming.
Patient: That's a relief. What about my cholesterol?
Dr. Johnson: Your LDL is still at 140, which is above target. I'm going to increase your Atorvastatin from 20mg to 40mg. I'd also like to start you on a low-dose Aspirin, 75mg daily, as a preventive measure given your risk profile.
Patient: Okay. Any side effects I should watch for?
Dr. Johnson: With the higher statin dose, watch for any muscle pain or weakness. The aspirin may cause mild stomach upset — take it after food. I want you to get a follow-up lipid panel in 3 months.
Patient: Should I change my diet?
Dr. Johnson: Yes, I strongly recommend a Mediterranean-style diet — more fish, olive oil, nuts, vegetables. And try to walk briskly for 30 minutes daily. That alone can improve your numbers significantly.
Patient: Thank you, doctor. I'll start right away.
Dr. Johnson: Great. I'll send the prescription to the pharmacy. See you in 3 months.`,
			medicines: [
				{ name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily at bedtime', duration: '3 months' },
				{ name: 'Aspirin', dosage: '75mg', frequency: 'Once daily after breakfast', duration: 'Ongoing' },
				{ name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', duration: 'Ongoing (continued)' }
			]
		},
		linkedRecords: [
			{
				fileUrl: '#ecg-report-jan2024',
				fileName: 'ECG_Report_Jan2024.pdf',
				uploadedAt: new Date(pastDate1.getTime() - 86400000),
				fileType: 'pdf'
			},
			{
				fileUrl: '#lipid-panel-jan2024',
				fileName: 'CBC_Lipid_Report_Jan2024.pdf',
				uploadedAt: new Date(pastDate1.getTime() - 172800000),
				fileType: 'pdf'
			}
		]
	});

	// ── Appointment 4: Completed (dermatology, 2 weeks ago) ──────────────
	const pastDate2 = new Date();
	pastDate2.setDate(pastDate2.getDate() - 14);

	const appointment4 = await AppointmentModel.create({
		patientId: patient._id,
		doctorId: doctorUser2._id,
		appointmentDate: dateOnly(pastDate2),
		startTime: '11:00',
		endTime: '11:30',
		durationMinutes: 30,
		reason: 'Dry, flaky skin patches on elbows and knees',
		notes: 'First visit to dermatologist.',
		urgency: 'low',
		status: 'completed',
		fee: 1800,
		paymentStatus: 'paid',
		createdBy: patient._id,
		timezone: 'Asia/Kolkata',
		aiPreparedSummary: {
			content: 'First dermatology consultation for Rahul Sharma.',
			editablePoints: ['Describe skin patches', 'Any family history of psoriasis'],
			isLocked: true,
			sharedWithDoctor: true,
			lockedAt: pastDate2,
			generatedAt: new Date(pastDate2.getTime() - 3600000)
		},
		consultationRecords: {
			meetingSummary: 'Patient presented with dry, scaly patches on elbows and knees, present for approximately 3 weeks. Examination revealed well-demarcated erythematous plaques with silvery-white scaling, consistent with mild plaque psoriasis. No joint involvement reported. Doctor prescribed topical Betamethasone 0.05% cream for affected areas twice daily and Moisturex cream for general dryness. Patient was advised to avoid harsh soaps and hot water. A follow-up in 4 weeks was scheduled to assess treatment response. If no improvement, a dermatology-specific blood panel may be ordered.',
			meetingTranscript: `Dr. Chen: Hello Rahul, I understand you have some skin concerns. Can you show me the affected areas?
Patient: Yes doctor, these patches on my elbows and knees. They've been there for about 3 weeks now.
Dr. Chen: I see. These are well-defined patches with silvery scaling. Have you noticed them spreading?
Patient: A little bit. They started small and got bigger. They're quite itchy at night.
Dr. Chen: Any family history of psoriasis or eczema?
Patient: My father had something similar on his scalp.
Dr. Chen: That's helpful context. Based on the presentation, this looks like mild plaque psoriasis. It's quite common and very manageable. I'm going to prescribe a topical steroid — Betamethasone cream — for the affected areas. Apply it twice daily for 2 weeks, then once daily for another 2 weeks.
Patient: Will it go away completely?
Dr. Chen: Psoriasis is a chronic condition, but it can be very well controlled. The cream should reduce the scaling and redness significantly. I also want you to use a good moisturizer — Moisturex — after every shower. Avoid harsh soaps and very hot water.
Patient: Okay. Should I be worried about it spreading?
Dr. Chen: Not with treatment. Let's see how you respond in 4 weeks. If needed, we can explore other options. For now, the topical approach should work well for mild cases like yours.`,
			medicines: [
				{ name: 'Betamethasone Cream 0.05%', dosage: 'Topical application', frequency: 'Twice daily for 2 weeks, then once daily', duration: '4 weeks' },
				{ name: 'Moisturex Cream', dosage: 'Liberal application', frequency: 'After every shower', duration: 'Ongoing' }
			]
		},
		linkedRecords: [
			{
				fileUrl: '#skin-photo-dec2023',
				fileName: 'Skin_Patches_Photo.jpg',
				uploadedAt: new Date(pastDate2.getTime() - 86400000),
				fileType: 'image'
			}
		]
	});

	// ── Create Prescriptions ─────────────────────────────────────────────
	console.log('💊 Creating prescriptions...');
	await PrescriptionModel.create({
		patientId: patient._id,
		doctorId: doctorUser1._id,
		appointmentId: appointment3._id,
		medicines: [
			{ name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily at bedtime', duration: '3 months', quantity: 90, price: 450 },
			{ name: 'Aspirin', dosage: '75mg', frequency: 'Once daily after breakfast', duration: 'Ongoing', quantity: 90, price: 125 },
			{ name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', duration: 'Ongoing', quantity: 60, price: 200 }
		],
		diagnosis: 'Hyperlipidemia, Pre-diabetes',
		notes: 'Increase Atorvastatin from 20mg to 40mg. Start Aspirin. Continue Metformin.',
		status: 'active'
	});

	await PrescriptionModel.create({
		patientId: patient._id,
		doctorId: doctorUser2._id,
		appointmentId: appointment4._id,
		medicines: [
			{ name: 'Betamethasone Cream 0.05%', dosage: 'Topical', frequency: 'Twice daily, then once daily', duration: '4 weeks', quantity: 2, price: 320 },
			{ name: 'Moisturex Cream', dosage: 'Liberal', frequency: 'After shower', duration: 'Ongoing', quantity: 1, price: 250 }
		],
		diagnosis: 'Mild Plaque Psoriasis',
		notes: 'First presentation. Topical management. Review in 4 weeks.',
		status: 'active'
	});

	// ── Create Transcripts ───────────────────────────────────────────────
	console.log('📝 Creating transcripts...');
	await TranscriptModel.create({
		appointmentId: appointment3._id,
		patientId: patient._id,
		doctorId: doctorUser1._id,
		rawText: appointment3.consultationRecords.meetingTranscript,
		summaryAi: appointment3.consultationRecords.meetingSummary,
		segments: [
			{ speaker: 'doctor', text: 'Good morning Rahul, how have you been feeling?', timestamp: new Date(pastDate1.getTime()) },
			{ speaker: 'patient', text: "Generally okay, but I've been getting occasional palpitations when I exercise.", timestamp: new Date(pastDate1.getTime() + 15000) },
			{ speaker: 'doctor', text: 'Your ECG shows normal sinus rhythm. The palpitations are likely due to deconditioning.', timestamp: new Date(pastDate1.getTime() + 60000) },
			{ speaker: 'doctor', text: "I'm increasing your Atorvastatin to 40mg and starting Aspirin 75mg daily.", timestamp: new Date(pastDate1.getTime() + 180000) },
			{ speaker: 'patient', text: 'Any side effects I should watch for?', timestamp: new Date(pastDate1.getTime() + 240000) },
			{ speaker: 'doctor', text: 'Watch for muscle pain. Take aspirin after food. Follow-up lipid panel in 3 months.', timestamp: new Date(pastDate1.getTime() + 300000) }
		],
		durationSeconds: 1200
	});

	await TranscriptModel.create({
		appointmentId: appointment4._id,
		patientId: patient._id,
		doctorId: doctorUser2._id,
		rawText: appointment4.consultationRecords.meetingTranscript,
		summaryAi: appointment4.consultationRecords.meetingSummary,
		segments: [
			{ speaker: 'doctor', text: 'I see well-defined patches with silvery scaling.', timestamp: new Date(pastDate2.getTime()) },
			{ speaker: 'patient', text: 'My father had something similar on his scalp.', timestamp: new Date(pastDate2.getTime() + 30000) },
			{ speaker: 'doctor', text: 'This looks like mild plaque psoriasis. Very manageable.', timestamp: new Date(pastDate2.getTime() + 90000) },
			{ speaker: 'doctor', text: 'Apply Betamethasone cream twice daily for 2 weeks.', timestamp: new Date(pastDate2.getTime() + 150000) }
		],
		durationSeconds: 900
	});

	// ── Summary ──────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(60));
	console.log('✅ SEED COMPLETE — Sample data inserted!');
	console.log('═'.repeat(60));
	console.log('\n📋 Created:');
	console.log(`   👤 Patient: Rahul Sharma (patient.demo@cliniq.ai)`);
	console.log(`   🩺 Doctor 1: Dr. Sarah Johnson (dr.sarah.demo@cliniq.ai)`);
	console.log(`   🩺 Doctor 2: Dr. Michael Chen (dr.chen.demo@cliniq.ai)`);
	console.log(`   🔑 Password for all: Demo@123`);
	console.log('');
	console.log('   📅 Appointment 1: Confirmed — ${apt1StartTime} today (Cardiology follow-up)');
	console.log(`   📅 Appointment 2: Pending — Tomorrow 2:30 PM (Dermatology)  `);
	console.log(`   ✅ Appointment 3: Completed — 7 days ago (Cardiac check-up + full records)`);
	console.log(`   ✅ Appointment 4: Completed — 14 days ago (Dermatology + full records)`);
	console.log('');
	console.log('   🔬 2 Lab Results (CBC/Lipid + Thyroid/Kidney panel)');
	console.log('   💊 2 Prescriptions (Cardiology + Dermatology)');
	console.log('   📝 2 Transcripts with meeting summaries');
	console.log('');
	console.log('🚀 Login as patient.demo@cliniq.ai / Demo@123 to test!');
	console.log('═'.repeat(60));

	await mongoose.disconnect();
	process.exit(0);
}

seed().catch(err => {
	console.error('❌ Seed failed:', err);
	process.exit(1);
});
