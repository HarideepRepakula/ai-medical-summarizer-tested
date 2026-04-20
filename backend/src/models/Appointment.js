import mongoose, { Schema } from "mongoose";

const AppointmentSchema = new Schema(
	{
		// Core appointment data
		patientId: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true,
			index: true
		},
		doctorId: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true,
			index: true
		},
		
		// Temporal data (stored in UTC)
		appointmentDate: { 
			type: Date, 
			required: true,
			index: true
		},
		startTime: { 
			type: String, 
			required: true,
			match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format validation
		},
		endTime: { 
			type: String, 
			required: true,
			match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
		},
		durationMinutes: {
			type: Number,
			required: true,
			min: 15,
			max: 480 // 8 hours max
		},
		timezone: {
			type: String,
			required: true,
			default: 'UTC'
		},
		
		// Appointment details
		reason: { 
			type: String, 
			required: true,
			maxlength: 500
		},
		notes: { 
			type: String, 
			default: '',
			maxlength: 1000
		},
		urgency: {
			type: String,
			enum: ['low', 'normal', 'high', 'emergency'],
			default: 'normal',
			index: true
		},
		
		// Status lifecycle with audit trail
		status: { 
			type: String, 
			enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'], 
			default: 'pending',
			index: true
		},
		statusHistory: [{
			status: {
				type: String,
				enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']
			},
			changedAt: { type: Date, default: Date.now },
			changedBy: { type: Schema.Types.ObjectId, ref: "User" },
			reason: String
		}],
		
		// Financial data
		fee: { 
			type: Number, 
			required: true,
			min: 0
		},
		paymentStatus: {
			type: String,
			enum: ['pending', 'paid', 'refunded', 'failed'],
			default: 'pending',
			index: true
		},
		
		// Concurrency control - Optimistic locking
		version: {
			type: Number,
			default: 0
		},
		
		// Slot reservation system
		slotReservationId: {
			type: String,
			unique: true,
			sparse: true
		},
		reservationExpiry: Date,
		
		// Metadata
		createdBy: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true 
		},
		lastModifiedBy: { 
			type: Schema.Types.ObjectId, 
			ref: "User" 
		},
		cancellationReason: String,
		cancelledAt: Date,
		cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
		
		// Rescheduling tracking
		originalAppointmentId: { 
			type: Schema.Types.ObjectId, 
			ref: "Appointment" 
		},
		rescheduledToId: { 
			type: Schema.Types.ObjectId, 
			ref: "Appointment" 
		},
		rescheduledCount: {
			type: Number,
			default: 0,
			max: 3 // Limit reschedules
		},
		// ── AI+ Features ────────────────────────────────────────────────────
		// Set to true when patient escalates from RAG chatbot
		emergencyEscalated:    { type: Boolean, default: false },
		emergencyEscalatedAt:  { type: Date },

		// ── AI Prepared Summary (Pre-Consultation Briefing) ──────────────
		aiPreparedSummary: {
			content:          { type: String, default: '' },
			editablePoints:   [{ type: String }],
			lockedAt:         { type: Date },
			isLocked:         { type: Boolean, default: false },
			sharedWithDoctor: { type: Boolean, default: false },
			generatedAt:      { type: Date }
		},

		// ── Consultation Records (Post-Consultation) ─────────────────────
		consultationRecords: {
			prescriptionId:      { type: Schema.Types.ObjectId, ref: 'Prescription' },
			prescriptionImageUrl: { type: String },
			meetingSummary:      { type: String, default: '' },
			meetingTranscript:   { type: String, default: '' },
			transcriptId:        { type: Schema.Types.ObjectId, ref: 'Transcript' },
			medicines: [{
				name:      { type: String },
				dosage:    { type: String },
				frequency: { type: String },
				duration:  { type: String }
			}]
		},

		// ── Uploaded Medical Records for this consultation ───────────────
		linkedRecords: [{
			fileUrl:    { type: String },
			fileName:   { type: String },
			uploadedAt: { type: Date, default: Date.now },
			fileType:   { type: String }
		}],
		uploadsLockedAt: { type: Date }
	},
	{ 
		timestamps: true,
		versionKey: 'version' // Use version field for optimistic concurrency
	}
);

// Compound unique index to prevent double booking
AppointmentSchema.index(
	{ 
		doctorId: 1, 
		appointmentDate: 1, 
		startTime: 1,
		status: 1
	}, 
	{ 
		unique: true,
		partialFilterExpression: { 
			status: { $in: ['pending', 'confirmed', 'in_progress'] } 
		},
		name: 'unique_active_appointment_slot'
	}
);

// Performance indexes
AppointmentSchema.index({ patientId: 1, appointmentDate: -1 }); // Patient's appointments
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, status: 1 }); // Doctor's schedule
AppointmentSchema.index({ appointmentDate: 1, status: 1 }); // Daily appointments
AppointmentSchema.index({ status: 1, appointmentDate: 1 }); // Status-based queries
AppointmentSchema.index({ urgency: 1, appointmentDate: 1 }); // Emergency appointments
AppointmentSchema.index({ createdAt: -1 }); // Recent appointments
AppointmentSchema.index({ reservationExpiry: 1 }, { sparse: true }); // Reservation cleanup

// Virtual for full datetime
AppointmentSchema.virtual('startDateTime').get(function() {
	const [hours, minutes] = this.startTime.split(':');
	const datetime = new Date(this.appointmentDate);
	datetime.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
	return datetime;
});

AppointmentSchema.virtual('endDateTime').get(function() {
	const [hours, minutes] = this.endTime.split(':');
	const datetime = new Date(this.appointmentDate);
	datetime.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
	return datetime;
});

// Pre-save middleware for validation and audit
AppointmentSchema.pre('save', function(next) {
	// Validate time logic
	const start = this.startTime.split(':').map(Number);
	const end = this.endTime.split(':').map(Number);
	const startMinutes = start[0] * 60 + start[1];
	const endMinutes = end[0] * 60 + end[1];
	
	if (endMinutes <= startMinutes) {
		return next(new Error('End time must be after start time'));
	}
	
	this.durationMinutes = endMinutes - startMinutes;
	
	// Update status history on status change
	if (this.isModified('status') && !this.isNew) {
		this.statusHistory.push({
			status: this.status,
			changedAt: new Date(),
			changedBy: this.lastModifiedBy
		});
	}
	
	next();
});

// Find conflicting appointments with time overlap detection
AppointmentSchema.statics.findConflicts = async function(doctorId, appointmentDate, startTime, endTime, excludeId = null) {
	const query = {
		doctorId,
		appointmentDate,
		status: { $in: ['pending', 'confirmed', 'in_progress'] },
		$or: [
			// New appointment starts during existing appointment
			{ startTime: { $lte: startTime }, endTime: { $gt: startTime } },
			// New appointment ends during existing appointment
			{ startTime: { $lt: endTime }, endTime: { $gte: endTime } },
			// New appointment completely contains existing appointment
			{ startTime: { $gte: startTime }, endTime: { $lte: endTime } }
		]
	};
	
	if (excludeId) {
		query._id = { $ne: excludeId };
	}
	
	return this.find(query);
};

// Atomic slot reservation
AppointmentSchema.statics.reserveSlot = async function(doctorId, appointmentDate, startTime, endTime, reservationId, expiryMinutes = 5) {
	const reservationExpiry = new Date(Date.now() + expiryMinutes * 60000);
	
	// Try to create a temporary reservation
	try {
		const reservation = await this.create({
			doctorId,
			appointmentDate,
			startTime,
			endTime,
			reason: 'SLOT_RESERVATION',
			patientId: new mongoose.Types.ObjectId(), // Temporary placeholder
			createdBy: new mongoose.Types.ObjectId(), // Temporary placeholder
			fee: 0,
			status: 'pending',
			slotReservationId: reservationId,
			reservationExpiry
		});
		return reservation;
	} catch (error) {
		if (error.code === 11000) { // Duplicate key error
			throw new Error('SLOT_ALREADY_BOOKED');
		}
		throw error;
	}
};

// Convert reservation to actual appointment
AppointmentSchema.statics.confirmReservation = async function(reservationId, appointmentData) {
	const session = await mongoose.startSession();
	
	try {
		await session.withTransaction(async () => {
			const reservation = await this.findOne({ slotReservationId: reservationId }).session(session);
			if (!reservation) {
				throw new Error('RESERVATION_NOT_FOUND');
			}
			
			if (reservation.reservationExpiry < new Date()) {
				throw new Error('RESERVATION_EXPIRED');
			}
			
			// Update reservation with actual appointment data
			await this.findByIdAndUpdate(
				reservation._id,
				{
					...appointmentData,
					$unset: { slotReservationId: 1, reservationExpiry: 1 }
				},
				{ session }
			);
		});
	} finally {
		await session.endSession();
	}
};

// Cleanup expired reservations
AppointmentSchema.statics.cleanupExpiredReservations = async function() {
	return this.deleteMany({
		slotReservationId: { $exists: true },
		reservationExpiry: { $lt: new Date() }
	});
};

export const AppointmentModel = mongoose.model("Appointment", AppointmentSchema);