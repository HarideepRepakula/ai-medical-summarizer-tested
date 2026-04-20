import Schedule from '../models/Schedule.js';

export const getSchedule = async (req, res) => {
	try {
		const { date } = req.query;
		const doctorId = req.user.id;
		
		const query = { doctorId };
		if (date) {
			const targetDate = new Date(date);
			query.date = {
				$gte: new Date(targetDate.setHours(0, 0, 0, 0)),
				$lt: new Date(targetDate.setHours(23, 59, 59, 999))
			};
		}
		
		const schedules = await Schedule.find(query)
			.populate('patientId', 'name')
			.sort({ date: 1, startTime: 1 });
		
		res.json({ schedules });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const addTimeSlot = async (req, res) => {
	try {
		const { date, startTime, endTime, repeat, days } = req.body;
		const doctorId = req.user.id;
		
		const scheduleData = {
			doctorId,
			date: new Date(date),
			startTime,
			endTime,
			type: 'available',
			repeat,
			days: repeat === 'weekly' ? days : []
		};
		
		const schedule = new Schedule(scheduleData);
		await schedule.save();
		
		res.status(201).json({ message: 'Time slot added successfully', schedule });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const blockTime = async (req, res) => {
	try {
		const { startDate, startTime, endDate, endTime, reason } = req.body;
		const doctorId = req.user.id;
		
		const schedule = new Schedule({
			doctorId,
			date: new Date(startDate),
			startTime,
			endTime,
			type: 'blocked',
			reason
		});
		
		await schedule.save();
		
		res.status(201).json({ message: 'Time blocked successfully', schedule });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};