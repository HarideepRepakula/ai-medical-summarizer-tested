/**
 * Validation middleware for appointment operations
 */

export const validateAppointmentBooking = (req, res, next) => {
	const { doctorId, appointmentDate, startTime, endTime, reason } = req.body;
	const errors = [];

	// Required fields validation
	if (!doctorId) errors.push('Doctor ID is required');
	if (!appointmentDate) errors.push('Appointment date is required');
	if (!startTime) errors.push('Start time is required');
	if (!endTime) errors.push('End time is required');
	if (!reason || reason.trim().length === 0) errors.push('Reason is required');

	// Date validation
	if (appointmentDate) {
		const appointmentDateTime = new Date(appointmentDate);
		if (isNaN(appointmentDateTime.getTime())) {
			errors.push('Invalid appointment date format');
		} else if (appointmentDateTime < new Date().setHours(0, 0, 0, 0)) {
			errors.push('Cannot book appointments in the past');
		}
	}

	// Time format validation
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (startTime && !timeRegex.test(startTime)) {
		errors.push('Invalid start time format. Use HH:MM');
	}
	if (endTime && !timeRegex.test(endTime)) {
		errors.push('Invalid end time format. Use HH:MM');
	}

	// Time logic validation
	if (startTime && endTime && timeRegex.test(startTime) && timeRegex.test(endTime)) {
		const [startHour, startMin] = startTime.split(':').map(Number);
		const [endHour, endMin] = endTime.split(':').map(Number);
		const startMinutes = startHour * 60 + startMin;
		const endMinutes = endHour * 60 + endMin;

		if (endMinutes <= startMinutes) {
			errors.push('End time must be after start time');
		}
		if (endMinutes - startMinutes < 15) {
			errors.push('Minimum appointment duration is 15 minutes');
		}
		if (endMinutes - startMinutes > 480) {
			errors.push('Maximum appointment duration is 8 hours');
		}
	}

	// Reason length validation
	if (reason && reason.trim().length > 500) {
		errors.push('Reason cannot exceed 500 characters');
	}

	// Notes length validation (optional field)
	if (req.body.notes && req.body.notes.length > 1000) {
		errors.push('Notes cannot exceed 1000 characters');
	}

	// Urgency validation (optional field)
	if (req.body.urgency && !['low', 'normal', 'high', 'emergency'].includes(req.body.urgency)) {
		errors.push('Invalid urgency level');
	}

	if (errors.length > 0) {
		return res.status(400).json({
			success: false,
			error: 'Validation failed',
			details: errors
		});
	}

	next();
};

export const validateAppointmentUpdate = (req, res, next) => {
	const { status, reason } = req.body;
	const errors = [];

	// Status validation
	if (!status) {
		errors.push('Status is required');
	} else if (!['pending', 'confirmed', 'cancelled', 'completed', 'in_progress', 'no_show'].includes(status)) {
		errors.push('Invalid status value');
	}

	// Reason validation for cancellation
	if (status === 'cancelled' && (!reason || reason.trim().length === 0)) {
		errors.push('Cancellation reason is required');
	}

	if (reason && reason.length > 500) {
		errors.push('Reason cannot exceed 500 characters');
	}

	if (errors.length > 0) {
		return res.status(400).json({
			success: false,
			error: 'Validation failed',
			details: errors
		});
	}

	next();
};

export const validateRescheduleRequest = (req, res, next) => {
	const { newDate, newStartTime, newEndTime, reason } = req.body;
	const errors = [];

	// Required fields
	if (!newDate) errors.push('New date is required');
	if (!newStartTime) errors.push('New start time is required');
	if (!newEndTime) errors.push('New end time is required');

	// Date validation
	if (newDate) {
		const appointmentDateTime = new Date(newDate);
		if (isNaN(appointmentDateTime.getTime())) {
			errors.push('Invalid new date format');
		} else if (appointmentDateTime < new Date().setHours(0, 0, 0, 0)) {
			errors.push('Cannot reschedule to past dates');
		}
	}

	// Time format validation
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (newStartTime && !timeRegex.test(newStartTime)) {
		errors.push('Invalid new start time format. Use HH:MM');
	}
	if (newEndTime && !timeRegex.test(newEndTime)) {
		errors.push('Invalid new end time format. Use HH:MM');
	}

	// Time logic validation
	if (newStartTime && newEndTime && timeRegex.test(newStartTime) && timeRegex.test(newEndTime)) {
		const [startHour, startMin] = newStartTime.split(':').map(Number);
		const [endHour, endMin] = newEndTime.split(':').map(Number);
		const startMinutes = startHour * 60 + startMin;
		const endMinutes = endHour * 60 + endMin;

		if (endMinutes <= startMinutes) {
			errors.push('New end time must be after new start time');
		}
		if (endMinutes - startMinutes < 15) {
			errors.push('Minimum appointment duration is 15 minutes');
		}
	}

	// Reason validation (optional)
	if (reason && reason.length > 500) {
		errors.push('Reschedule reason cannot exceed 500 characters');
	}

	if (errors.length > 0) {
		return res.status(400).json({
			success: false,
			error: 'Validation failed',
			details: errors
		});
	}

	next();
};

export const validatePaginationParams = (req, res, next) => {
	const { page, limit } = req.query;

	if (page && (isNaN(page) || parseInt(page) < 1)) {
		return res.status(400).json({
			success: false,
			error: 'Page must be a positive integer'
		});
	}

	if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
		return res.status(400).json({
			success: false,
			error: 'Limit must be between 1 and 100'
		});
	}

	next();
};

export const validateDateRange = (req, res, next) => {
	const { startDate, endDate } = req.query;

	if (startDate && isNaN(new Date(startDate).getTime())) {
		return res.status(400).json({
			success: false,
			error: 'Invalid start date format'
		});
	}

	if (endDate && isNaN(new Date(endDate).getTime())) {
		return res.status(400).json({
			success: false,
			error: 'Invalid end date format'
		});
	}

	if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
		return res.status(400).json({
			success: false,
			error: 'Start date cannot be after end date'
		});
	}

	next();
};