import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
	doctorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	date: {
		type: Date,
		required: true
	},
	startTime: {
		type: String,
		required: true
	},
	endTime: {
		type: String,
		required: true
	},
	type: {
		type: String,
		enum: ['available', 'blocked', 'booked'],
		default: 'available'
	},
	reason: {
		type: String // For blocked slots
	},
	patientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User' // For booked slots
	},
	repeat: {
		type: String,
		enum: ['once', 'daily', 'weekly'],
		default: 'once'
	},
	days: [{
		type: String // For weekly repeats: ['Mon', 'Tue', etc.]
	}]
}, {
	timestamps: true
});

export default mongoose.model('Schedule', scheduleSchema);