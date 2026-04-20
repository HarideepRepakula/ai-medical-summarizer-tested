import mongoose, { Schema } from "mongoose";

const MedicineSchema = new Schema({
	name:      { type: String, required: true },
	dosage:    { type: String, required: true },
	frequency: { type: String, required: true }, // e.g. "Once daily"
	duration:  { type: String },                  // e.g. "7 days"
	quantity:  { type: Number, required: true },
	price:     { type: Number, default: 0 },
	notes:     { type: String }
}, { _id: false });

const PrescriptionSchema = new Schema(
	{
		patientId:        { type: Schema.Types.ObjectId, ref: "User",        required: true },
		doctorId:         { type: Schema.Types.ObjectId, ref: "User",        required: true },
		appointmentId:    { type: Schema.Types.ObjectId, ref: "Appointment", required: false },
		medicines:        { type: [MedicineSchema], required: true, validate: v => v.length > 0 },
		diagnosis:        { type: String },
		notes:            { type: String },
		status:           { type: String, enum: ["active", "cancelled", "completed"], default: "active" },
		autoCartCreated:  { type: Boolean, default: false }
	},
	{ timestamps: true }
);

// Index for quick patient lookup
PrescriptionSchema.index({ patientId: 1, createdAt: -1 });
PrescriptionSchema.index({ appointmentId: 1 });

export const PrescriptionModel = mongoose.model("Prescription", PrescriptionSchema);
