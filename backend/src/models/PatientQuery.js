import mongoose, { Schema } from 'mongoose';

const PatientQuerySchema = new Schema(
	{
		appointmentId:  { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
		patientId:      { type: Schema.Types.ObjectId, ref: 'User',        required: true },
		doctorId:       { type: Schema.Types.ObjectId, ref: 'User',        required: true },
		question:       { type: String, required: true, maxlength: 2000 },
		doctorResponse: { type: String, default: '' },
		respondedAt:    { type: Date },
		escalatedAt:    { type: Date, default: Date.now },
		status:         { type: String, enum: ['pending', 'answered'], default: 'pending' }
	},
	{ timestamps: true }
);

PatientQuerySchema.index({ appointmentId: 1, createdAt: -1 });
PatientQuerySchema.index({ doctorId: 1, status: 1 });

export const PatientQueryModel = mongoose.model('PatientQuery', PatientQuerySchema);
