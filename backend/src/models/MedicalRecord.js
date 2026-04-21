import mongoose, { Schema } from "mongoose";

const MedicalRecordSchema = new Schema(
	{
		patientId:  { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
		recordName: { type: String, required: true, maxlength: 200 },
		fileUrl:    { type: String, required: true },
		fileName:   { type: String, required: true },
		fileType:   { type: String, enum: ["Lab Report", "Prescription", "Scan", "Other", "Consultation Upload"], default: "Other" },
		mimeType:   { type: String },
		fileSize:   { type: Number },
		appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },
		// AI-generated summary cached after upload
		aiSummary:  { type: String, default: '' },
		aiSummaryGeneratedAt: { type: Date },
		uploadedAt: { type: Date, default: Date.now }
	},
	{ timestamps: true }
);

MedicalRecordSchema.index({ patientId: 1, uploadedAt: -1 });

export const MedicalRecordModel = mongoose.model("MedicalRecord", MedicalRecordSchema);
