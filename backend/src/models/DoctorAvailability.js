import mongoose, { Schema } from "mongoose";

const DoctorAvailabilitySchema = new Schema(
	{
		doctorId: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true,
			index: true
		},
		
		// Date-specific availability
		date: { 
			type: Date, 
			required: true,
			index: true
		},
		
		// Available time slots
		timeSlots: [{
			startTime: {
				type: String,
				required: true,
				match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
			},
			endTime: {
				type: String,
				required: true,
				match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
			},
			isAvailable: {
				type: Boolean,
				default: true
			},
			slotType: {
				type: String,
				enum: ['consultation', 'follow_up', 'emergency', 'blocked'],
				default: 'consultation'
			},
			maxBookings: {
				type: Number,
				default: 1,
				min: 0,
				max: 5
			},
			currentBookings: {
				type: Number,
				default: 0,
				min: 0
			},
			// Optimistic locking for slot booking
			version: {
				type: Number,
				default: 0
			}
		}],
		
		// Recurring availability pattern
		recurringPattern: {
			isRecurring: {
				type: Boolean,
				default: false
			},
			frequency: {
				type: String,
				enum: ['daily', 'weekly', 'monthly'],
				default: 'weekly'
			},
			daysOfWeek: [{
				type: Number,
				min: 0,
				max: 6 // 0 = Sunday, 6 = Saturday
			}],
			endDate: Date
		},
		
		// Break times and blocked periods
		breaks: [{
			startTime: String,
			endTime: String,
			reason: String,
			type: {
				type: String,
				enum: ['lunch', 'meeting', 'emergency', 'personal'],
				default: 'lunch'
			}
		}],
		
		// Metadata
		timezone: {
			type: String,
			required: true,
			default: 'UTC'
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true
		},
		createdBy: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true 
		},
		lastModifiedBy: { 
			type: Schema.Types.ObjectId, 
			ref: "User" 
		}
	},
	{ 
		timestamps: true 
	}
);

// Compound indexes for efficient queries
DoctorAvailabilitySchema.index({ doctorId: 1, date: 1 }, { unique: true });
DoctorAvailabilitySchema.index({ date: 1, isActive: 1 });
DoctorAvailabilitySchema.index({ doctorId: 1, date: 1, isActive: 1 });

// Virtual for checking if date is in the past
DoctorAvailabilitySchema.virtual('isPastDate').get(function() {
	return this.date < new Date();
});

// Static method to find available slots
DoctorAvailabilitySchema.statics.findAvailableSlots = async function(doctorId, date, duration = 30) {
	const availability = await this.findOne({
		doctorId,
		date,
		isActive: true
	});
	
	if (!availability) return [];
	
	return availability.timeSlots.filter(slot => 
		slot.isAvailable && 
		slot.currentBookings < slot.maxBookings &&
		slot.slotType !== 'blocked'
	);
};

// Method to book a slot atomically
DoctorAvailabilitySchema.statics.bookSlot = async function(doctorId, date, startTime, endTime) {
	const result = await this.findOneAndUpdate(
		{
			doctorId,
			date,
			isActive: true,
			'timeSlots': {
				$elemMatch: {
					startTime,
					endTime,
					isAvailable: true,
					$expr: { $lt: ['$currentBookings', '$maxBookings'] }
				}
			}
		},
		{
			$inc: { 
				'timeSlots.$.currentBookings': 1,
				'timeSlots.$.version': 1
			}
		},
		{ new: true }
	);
	
	return result;
};

// Method to release a slot
DoctorAvailabilitySchema.statics.releaseSlot = async function(doctorId, date, startTime, endTime) {
	return this.findOneAndUpdate(
		{
			doctorId,
			date,
			'timeSlots': {
				$elemMatch: {
					startTime,
					endTime,
					currentBookings: { $gt: 0 }
				}
			}
		},
		{
			$inc: { 
				'timeSlots.$.currentBookings': -1,
				'timeSlots.$.version': 1
			}
		},
		{ new: true }
	);
};

export const DoctorAvailabilityModel = mongoose.model("DoctorAvailability", DoctorAvailabilitySchema);