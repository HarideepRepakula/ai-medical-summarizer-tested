import mongoose, { Schema } from "mongoose";

const MedicalRecordSchema = new Schema(
	{
		patientId:  { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
		recordName: { type: String, required: true, maxlength: 200 },
		fileUrl:    { type: String, required: true },
		fileName:   { type: String, required: true },
		fileType:   { type: String, enum: ["Lab Report", "Prescription", "Scan", "Other"], default: "Other" },
		mimeType:   { type: String },
		fileSize:   { type: Number },
		uploadedAt: { type: Date, default: Date.now }
	},
	{ timestamps: true }
);

MedicalRecordSchema.index({ patientId: 1, uploadedAt: -1 });

export const MedicalRecordModel = mongoose.model("MedicalRecord", MedicalRecordSchema);
