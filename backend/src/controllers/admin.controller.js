/**
 * AI Admin Controller — MedHub Autonomous Admin
 * Handles system health reports, doctor verification review,
 * fraud detection, and content moderation.
 */

import { AppointmentModel } from "../models/Appointment.js";
import { UserModel }        from "../models/User.js";
import { DoctorModel }      from "../models/Doctor.js";
import { aiAdminSystemReport, aiAdminVerifyDoctor, aiAdminModerateRecord } from "../services/ollamaService.js";
import Tesseract from "tesseract.js";

// ─── System Health Report ─────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-report
 * AI Admin analyzes platform metrics and generates a health report.
 */
export async function getAiSystemReport(req, res) {
	try {
		const now     = new Date();
		const since24 = new Date(now - 24 * 60 * 60 * 1000);

		// Gather metrics in parallel
		const [
			totalAppts, completedAppts, cancelledAppts, pendingAppts,
			totalUsers, lockedUsers,
			pendingDoctors, rejectedDoctors
		] = await Promise.all([
			AppointmentModel.countDocuments({}),
			AppointmentModel.countDocuments({ status: 'completed' }),
			AppointmentModel.countDocuments({ status: 'cancelled' }),
			AppointmentModel.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),
			UserModel.countDocuments({}),
			UserModel.countDocuments({ lockUntil: { $gt: now } }),
			DoctorModel.countDocuments({ verificationStatus: 'pending' }),
			DoctorModel.countDocuments({ verificationStatus: 'rejected' })
		]);

		// Find recently locked users (potential fraud)
		const flaggedUsers = await UserModel.find({
			lockUntil: { $gt: now }
		}).select('email failedLoginAttempts lockUntil').limit(10).lean();

		const report = await aiAdminSystemReport({
			appointments: {
				total:     totalAppts,
				completed: completedAppts,
				cancelled: cancelledAppts,
				pending:   pendingAppts
			},
			recentLogins: {
				total:  totalUsers,
				failed: flaggedUsers.reduce((s, u) => s + (u.failedLoginAttempts || 0), 0),
				locked: lockedUsers
			},
			flaggedUsers: flaggedUsers.map(u => ({
				email:  u.email,
				reason: `${u.failedLoginAttempts} failed login attempts`
			}))
		});

		res.json({
			success: true,
			data: {
				...report,
				rawMetrics: {
					appointments: { totalAppts, completedAppts, cancelledAppts, pendingAppts },
					users:        { totalUsers, lockedUsers },
					doctors:      { pendingDoctors, rejectedDoctors }
				},
				generatedAt: new Date().toISOString()
			}
		});

	} catch (error) {
		console.error('[AI-ADMIN] System report error:', error.message);
		res.status(500).json({ success: false, error: 'Failed to generate system report.' });
	}
}

// ─── Pending Doctor Verifications ─────────────────────────────────────────────

/**
 * GET /api/admin/pending-verifications
 * Returns all doctors awaiting AI Admin verification.
 */
export async function getPendingVerifications(req, res) {
	try {
		const pending = await DoctorModel.find({ verificationStatus: 'pending' })
			.populate('userId', 'name email phone createdAt')
			.lean();

		res.json({
			success: true,
			data: {
				count:   pending.length,
				doctors: pending.map(d => ({
					doctorId:           d._id,
					name:               d.userId?.name,
					email:              d.userId?.email,
					specialty:          d.specialty,
					licenseNumber:      d.licenseNumber,
					verificationStatus: d.verificationStatus,
					adminNote:          d.adminNote,
					registeredAt:       d.userId?.createdAt
				}))
			}
		});
	} catch (error) {
		console.error('[AI-ADMIN] Pending verifications error:', error.message);
		res.status(500).json({ success: false, error: 'Failed to fetch pending verifications.' });
	}
}

// ─── Re-run AI Verification ───────────────────────────────────────────────────

/**
 * POST /api/admin/verify-doctor/:doctorId
 * Re-runs AI Admin verification on an uploaded license file.
 * Body: multipart/form-data with `file` field (license image).
 */
export async function reVerifyDoctor(req, res) {
	try {
		const { doctorId } = req.params;

		const doctor = await DoctorModel.findById(doctorId).populate('userId', 'name');
		if (!doctor) {
			return res.status(404).json({ success: false, error: 'Doctor not found.' });
		}

		if (!req.file) {
			return res.status(400).json({ success: false, error: 'License file is required.' });
		}

		console.log(`[AI-ADMIN] Re-verifying doctor ${doctorId}`);
		const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng');

		const aiDecision = await aiAdminVerifyDoctor(
			{ name: doctor.userId.name, specialty: doctor.specialty, licenseNumber: doctor.licenseNumber },
			text
		);

		const isVerified = aiDecision.decision === 'approved' && aiDecision.confidenceScore > 80;

		await DoctorModel.findByIdAndUpdate(doctorId, {
			isVerified,
			verificationStatus: isVerified ? 'approved' : 'rejected',
			verificationScore:  aiDecision.confidenceScore,
			adminNote:          aiDecision.reason,
			verifiedAt:         isVerified ? new Date() : undefined
		});

		console.log(`[AI-ADMIN] Re-verification result: ${aiDecision.decision} (score: ${aiDecision.confidenceScore})`);

		res.json({
			success: true,
			data: {
				doctorId,
				decision:        aiDecision.decision,
				confidenceScore: aiDecision.confidenceScore,
				reason:          aiDecision.reason,
				isVerified
			}
		});

	} catch (error) {
		console.error('[AI-ADMIN] Re-verify error:', error.message);
		res.status(500).json({ success: false, error: 'Verification failed.' });
	}
}

// ─── Fraud Detection — Locked Accounts ───────────────────────────────────────

/**
 * GET /api/admin/security/locked-accounts
 * Returns all currently locked accounts with lock reason.
 */
export async function manualApproveDoctor(req,res){try{const{doctorId}=req.params;const doctor=await DoctorModel.findByIdAndUpdate(doctorId,{isVerified:true,verificationStatus:"approved",verifiedAt:new Date(),adminNote:"Manually approved by admin."},{new:true});if(!doctor)return res.status(404).json({success:false,error:"Doctor not found."});res.json({success:true,message:"Doctor approved successfully."});}catch(e){res.status(500).json({success:false,error:"Approval failed."})}}

export async function getLockedAccounts(req, res) {
	try {
		const now     = new Date();
		const locked  = await UserModel.find({ lockUntil: { $gt: now } })
			.select('name email role failedLoginAttempts lockUntil lastLoginIP createdAt')
			.lean();

		res.json({
			success: true,
			data: {
				count:    locked.length,
				accounts: locked.map(u => ({
					userId:              u._id,
					name:                u.name,
					email:               u.email,
					role:                u.role,
					failedAttempts:      u.failedLoginAttempts,
					lockedUntil:         u.lockUntil,
					lastLoginIP:         u.lastLoginIP,
					minutesUntilUnlock:  Math.round((new Date(u.lockUntil) - now) / 60000)
				}))
			}
		});
	} catch (error) {
		console.error('[AI-ADMIN] Locked accounts error:', error.message);
		res.status(500).json({ success: false, error: 'Failed to fetch locked accounts.' });
	}
}

// ─── Manual Override — Unlock Account ────────────────────────────────────────

/**
 * POST /api/admin/security/unlock/:userId
 * AI Admin manually unlocks a user account.
 */
export async function unlockAccount(req, res) {
	try {
		const { userId } = req.params;
		await UserModel.findByIdAndUpdate(userId, {
			$unset: { lockUntil: 1 },
			$set:   { failedLoginAttempts: 0 }
		});
		console.log(`[AI-ADMIN] Account unlocked: ${userId}`);
		res.json({ success: true, message: 'Account unlocked by AI Admin.' });
	} catch (error) {
		console.error('[AI-ADMIN] Unlock error:', error.message);
		res.status(500).json({ success: false, error: 'Failed to unlock account.' });
	}
}

// ─── Content Moderation ───────────────────────────────────────────────────────

/**
 * POST /api/admin/moderate-record
 * AI Admin checks if an uploaded medical record contains legitimate medical content.
 * Body: multipart/form-data with `file` + `recordName`
 */
export async function moderateRecord(req, res) {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: 'File is required.' });
		}

		const recordName = req.body.recordName || 'Unknown Record';

		const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng');
		const result = await aiAdminModerateRecord(recordName, text);

		console.log(`[AI-ADMIN] Moderation: "${recordName}" → flagged=${result.flagged}`);

		res.json({ success: true, data: result });

	} catch (error) {
		console.error('[AI-ADMIN] Moderation error:', error.message);
		res.status(500).json({ success: false, error: 'Moderation check failed.' });
	}
}
