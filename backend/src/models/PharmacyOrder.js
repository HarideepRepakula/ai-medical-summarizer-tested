import mongoose, { Schema } from "mongoose";

// Each medicine line in a pharmacy order
const OrderItemSchema = new Schema({
	medicineId:  { type: Schema.Types.ObjectId, ref: "Inventory" },
	name:        { type: String, required: true },
	dosage:      { type: String },
	quantity:    { type: Number, required: true },
	unitPrice:   { type: Number, default: 0 },
	lineTotal:   { type: Number, default: 0 },
	// Patient can deselect individual items from the AI-generated cart
	deselected:  { type: Boolean, default: false },
	inStock:     { type: Boolean, default: true }
}, { _id: false });

const PharmacyOrderSchema = new Schema(
	{
		patientId:      { type: Schema.Types.ObjectId, ref: "User",         required: true },
		prescriptionId: { type: Schema.Types.ObjectId, ref: "Prescription", required: true },
		doctorId:       { type: Schema.Types.ObjectId, ref: "User" },
		medicines:      { type: [OrderItemSchema], default: [] },
		status: {
			type: String,
			enum: ["pending_patient_review", "confirmed", "processing", "ready", "delivered", "cancelled"],
			default: "pending_patient_review"
		},
		deliveryOption: { type: String, enum: ["pickup", "delivery"], default: "delivery" },
		deliveryAddress: { type: String },
		// Computed total (only non-deselected items)
		total:          { type: Number, default: 0 },
		// Doctor's pharmacy notes
		pharmacyNotes:  { type: String },
		confirmedAt:    { type: Date },
		processedAt:    { type: Date },
		deliveredAt:    { type: Date }
	},
	{ timestamps: true }
);

PharmacyOrderSchema.index({ patientId: 1, createdAt: -1 });
PharmacyOrderSchema.index({ prescriptionId: 1 });
PharmacyOrderSchema.index({ status: 1 });

export const PharmacyOrderModel = mongoose.model("PharmacyOrder", PharmacyOrderSchema);
