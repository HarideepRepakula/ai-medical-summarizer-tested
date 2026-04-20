import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
	{
		userId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
		// Which event triggered this
		event:    {
			type: String,
			enum: ["booking_confirmed", "appointment_cancelled", "appointment_rescheduled",
			       "prescription_ready", "pharmacy_order_update", "emergency_escalation",
			       "lab_result_uploaded", "pre_consult_reminder"],
			required: true
		},
		// Delivery channel
		channel:  { type: String, enum: ["in-app", "email", "sms"], default: "in-app" },
		type:     { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
		title:    { type: String, required: true },
		message:  { type: String, required: true },
		// Link to navigate to when clicked
		actionUrl: { type: String },
		// Stub fields for Nodemailer / Twilio — populate before sending
		emailTo:  { type: String },
		smsTo:    { type: String },
		status:   { type: String, enum: ["pending", "sent", "failed", "read"], default: "pending" },
		readAt:   { type: Date },
		// Reference to the related entity
		metadata: { type: Schema.Types.Mixed }
	},
	{ timestamps: true }
);

NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const NotificationModel = mongoose.model("Notification", NotificationSchema);
