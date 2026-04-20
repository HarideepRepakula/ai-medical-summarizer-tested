import mongoose, { Schema } from "mongoose";

const DoctorSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
		specialty: {
			type: String,
			required: true,
			enum: ['Cardiology', 'Dermatology', 'General Physician', 'Pediatrics', 'Neurology', 'Orthopedics', 'Psychiatry', 'Gynecology', 'ENT', 'Ophthalmology']
		},
		experience:      { type: String, required: true },
		rating:          { type: Number, default: 4.5, min: 0, max: 5 },
		consultationFee: { type: Number, required: true },
		availability: [{
			day:       { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
			startTime: String,
			endTime:   String
		}],
		image: { type: String, default: '' },

		// ── AI Admin Verification ─────────────────────────────────────────────
		licenseNumber:      { type: String, default: '' },
		isVerified:         { type: Boolean, default: false },
		verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
		verificationScore:  { type: Number, default: 0 },   // AI confidence 0-100
		adminNote:          { type: String, default: '' },   // AI explanation
		verifiedAt:         { type: Date }
	},
	{ timestamps: true }
);

export const DoctorModel = mongoose.model("Doctor", DoctorSchema);
