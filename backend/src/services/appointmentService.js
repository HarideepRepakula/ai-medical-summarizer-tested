import { AppointmentModel } from "../models/Appointment.js";
import { DoctorModel } from "../models/Doctor.js";

/**
 * Appointment Service Layer
 * Handles business logic, caching, and complex operations
 */
class AppointmentService {
	constructor() {
		// Simple in-memory cache for doctor availability
		this.availabilityCache = new Map();
		this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
	}

	/**
	 * Get cached doctor availability or fetch from database
	 */
	async getDoctorAvailability(doctorId, date) {
		const cacheKey = `${doctorId}-${date}`;
		const cached = this.availabilityCache.get(cacheKey);
		
		if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
			return cached.data;
		}
		
		// Fetch from database
		const queryDate = new Date(date);
		const bookedSlots = await AppointmentModel.find({
			doctorId,
			appointmentDate: queryDate,
			status: { $in: ['pending', 'confirmed', 'in_progress'] }
		}).select('startTime endTime').lean();
		
		// Generate available slots
		const availableSlots = this.generateAvailableSlots(bookedSlots);
		
		const result = {
			date,
			availableSlots,
			bookedSlots: bookedSlots.map(slot => ({
				startTime: slot.startTime,
				endTime: slot.endTime
			}))
		};
		
		// Cache the result
		this.availabilityCache.set(cacheKey, {
			data: result,
			timestamp: Date.now()
		});
		
		return result;
	}

	/**
	 * Generate available time slots
	 */
	generateAvailableSlots(bookedSlots, startHour = 9, endHour = 17, slotDuration = 30) {
		const availableSlots = [];
		
		for (let hour = startHour; hour < endHour; hour++) {
			for (let minute = 0; minute < 60; minute += slotDuration) {
				const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
				const endMinute = minute + slotDuration;
				const endTime = endMinute >= 60 
					? `${(hour + 1).toString().padStart(2, '0')}:${(endMinute - 60).toString().padStart(2, '0')}`
					: `${hour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
				
				// Check if slot is available
				const isBooked = bookedSlots.some(slot => 
					this.timeSlotsOverlap(startTime, endTime, slot.startTime, slot.endTime)
				);
				
				if (!isBooked) {
					availableSlots.push({ startTime, endTime });
				}
			}
		}
		
		return availableSlots;
	}

	/**
	 * Check if two time slots overlap
	 */
	timeSlotsOverlap(start1, end1, start2, end2) {
		return (start1 < end2) && (end1 > start2);
	}

	/**
	 * Invalidate cache for doctor availability
	 */
	invalidateAvailabilityCache(doctorId, date) {
		const cacheKey = `${doctorId}-${date}`;
		this.availabilityCache.delete(cacheKey);
	}

	/**
	 * Get appointment statistics for dashboard
	 */
	async getAppointmentStats(userId, userRole, dateRange = 30) {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - dateRange);
		
		let filter = { appointmentDate: { $gte: startDate } };
		
		if (userRole === 'PATIENT') {
			filter.patientId = userId;
		} else if (userRole === 'DOCTOR') {
			filter.doctorId = userId;
		}
		
		const stats = await AppointmentModel.aggregate([
			{ $match: filter },
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 },
					totalFee: { $sum: '$fee' }
				}
			}
		]);
		
		const upcomingAppointments = await AppointmentModel.countDocuments({
			...filter,
			appointmentDate: { $gte: new Date() },
			status: { $in: ['pending', 'confirmed'] }
		});
		
		return {
			statusBreakdown: stats,
			upcomingAppointments,
			dateRange
		};
	}

	/**
	 * Find optimal appointment slots for patient preferences
	 */
	async findOptimalSlots(doctorId, preferredDates, preferredTimes, duration = 30) {
		const optimalSlots = [];
		
		for (const date of preferredDates) {
			const availability = await this.getDoctorAvailability(doctorId, date);
			
			for (const slot of availability.availableSlots) {
				const slotScore = this.calculateSlotScore(slot, preferredTimes, duration);
				if (slotScore > 0) {
					optimalSlots.push({
						date,
						...slot,
						score: slotScore
					});
				}
			}
		}
		
		// Sort by score (highest first)
		return optimalSlots.sort((a, b) => b.score - a.score).slice(0, 10);
	}

	/**
	 * Calculate slot preference score
	 */
	calculateSlotScore(slot, preferredTimes, duration) {
		let score = 1; // Base score
		
		// Check if slot matches preferred times
		for (const preferredTime of preferredTimes) {
			if (slot.startTime === preferredTime) {
				score += 10;
			} else if (Math.abs(this.timeToMinutes(slot.startTime) - this.timeToMinutes(preferredTime)) <= 60) {
				score += 5; // Within 1 hour
			}
		}
		
		// Prefer morning slots (9 AM - 12 PM)
		const slotHour = parseInt(slot.startTime.split(':')[0]);
		if (slotHour >= 9 && slotHour < 12) {
			score += 2;
		}
		
		return score;
	}

	/**
	 * Convert time string to minutes
	 */
	timeToMinutes(timeStr) {
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + minutes;
	}

	/**
	 * Bulk operations for admin
	 */
	async bulkUpdateAppointments(appointmentIds, updates, userId) {
		const session = await mongoose.startSession();
		
		try {
			await session.withTransaction(async () => {
				const result = await AppointmentModel.updateMany(
					{ _id: { $in: appointmentIds } },
					{ 
						...updates, 
						lastModifiedBy: userId,
						$inc: { version: 1 }
					},
					{ session }
				);
				
				return result;
			});
		} finally {
			await session.endSession();
		}
	}

	/**
	 * Generate appointment report
	 */
	async generateAppointmentReport(filters, format = 'json') {
		const pipeline = [
			{ $match: filters },
			{
				$lookup: {
					from: 'users',
					localField: 'patientId',
					foreignField: '_id',
					as: 'patient'
				}
			},
			{
				$lookup: {
					from: 'users',
					localField: 'doctorId',
					foreignField: '_id',
					as: 'doctor'
				}
			},
			{
				$project: {
					appointmentDate: 1,
					startTime: 1,
					endTime: 1,
					status: 1,
					urgency: 1,
					fee: 1,
					paymentStatus: 1,
					'patient.name': 1,
					'patient.email': 1,
					'doctor.name': 1,
					'doctor.specialty': 1,
					createdAt: 1
				}
			},
			{ $sort: { appointmentDate: -1 } }
		];
		
		const appointments = await AppointmentModel.aggregate(pipeline);
		
		if (format === 'csv') {
			return this.convertToCSV(appointments);
		}
		
		return appointments;
	}

	/**
	 * Convert data to CSV format
	 */
	convertToCSV(data) {
		if (!data.length) return '';
		
		const headers = Object.keys(data[0]).join(',');
		const rows = data.map(row => Object.values(row).join(','));
		
		return [headers, ...rows].join('\n');
	}

	/**
	 * Cleanup service - remove old cancelled appointments
	 */
	async cleanupOldAppointments(daysOld = 90) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysOld);
		
		const result = await AppointmentModel.deleteMany({
			status: 'cancelled',
			cancelledAt: { $lt: cutoffDate }
		});
		
		return result.deletedCount;
	}
}

export const appointmentService = new AppointmentService();