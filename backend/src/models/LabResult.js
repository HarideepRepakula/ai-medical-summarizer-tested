import mongoose, { Schema } from "mongoose";

// A single parsed lab test result (e.g. { testName: "Glucose", value: "110", unit: "mg/dL" })
const StructuredTestSchema = new Schema({
	testName:       { type: String, required: true },
	value:          { type: String, required: true }, // Keep as string to handle ranges
	numericValue:   { type: Number },                  // Parsed float for charting
	unit:           { type: String },
	referenceRange: { type: String },                  // e.g. "70-100 mg/dL"
	flag:           { type: String, enum: ["normal", "high", "low", "critical", "unknown"], default: "unknown" }
}, { _id: false });

const LabResultSchema = new Schema(
	{
		patientId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
		uploadedBy:     { type: Schema.Types.ObjectId, ref: "User" },   // Could be patient or doctor
		rawOcrText:     { type: String },                                  // Full Tesseract.js output
		structuredData: { type: [StructuredTestSchema], default: [] },     // Gemini-parsed results
		fileName:       { type: String, required: true },
		fileType:       { type: String, enum: ["pdf", "image", "jpg", "jpeg", "png", "tiff"] },
		recordDate:     { type: Date },                                    // Date shown on the lab report
		labName:        { type: String },
		doctorOrdered:  { type: String }
	},
	{ timestamps: true }
);

// Index for Health Timeline queries
LabResultSchema.index({ patientId: 1, recordDate: -1 });
LabResultSchema.index({ patientId: 1, createdAt: -1 });

export const LabResultModel = mongoose.model("LabResult", LabResultSchema);
