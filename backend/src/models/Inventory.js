import mongoose, { Schema } from "mongoose";

const InventorySchema = new Schema(
	{
		name:          { type: String, required: true, text: true }, // Full product name e.g. "Amoxicillin 500mg"
		genericName:   { type: String, text: true },                  // e.g. "Amoxicillin"
		brand:         { type: String },
		category:      { type: String, enum: [
			"Antibiotics", "Cardiovascular", "Diabetes", "Cholesterol",
			"Gastric", "Analgesic", "Antihistamine", "Antiviral",
			"Vitamins", "Ophthalmology", "Dermatology", "Other"
		], default: "Other" },
		dosageStrength: { type: String },                             // e.g. "500mg", "10mg/5ml"
		unit:           { type: String, default: "tablet" },          // tablet, capsule, ml, etc.
		stock:          { type: Number, required: true, min: 0, default: 0 },
		reorderPoint:   { type: Number, default: 20 },
		price:          { type: Number, required: true, min: 0 },
		batchNumber:    { type: String },
		expiryDate:     { type: Date },
		manufacturer:   { type: String },
		// Computed status field
		status: {
			type: String,
			enum: ["in-stock", "low-stock", "critical", "out-of-stock"],
			default: "in-stock"
		},
		isActive:       { type: Boolean, default: true }
	},
	{ timestamps: true }
);

// Auto-update status based on stock levels before save
InventorySchema.pre("save", function (next) {
	if (this.stock <= 0) {
		this.status = "out-of-stock";
	} else if (this.stock <= 5) {
		this.status = "critical";
	} else if (this.stock <= this.reorderPoint) {
		this.status = "low-stock";
	} else {
		this.status = "in-stock";
	}
	next();
});

// Text search index for auto-cart medicine matching
InventorySchema.index({ name: "text", genericName: "text", brand: "text" });
InventorySchema.index({ status: 1 });
InventorySchema.index({ isActive: 1 });

export const InventoryModel = mongoose.model("Inventory", InventorySchema);
