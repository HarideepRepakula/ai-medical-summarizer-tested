import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useConsultationTimer — Live countdown hook for consultation lifecycle
 * 
 * Computes:
 *  - minutesUntilStart: float, minutes remaining until appointment
 *  - uploadsLocked:     true when T < 15 min (no more file uploads)
 *  - summaryLocked:     true when T < 10 min (summary shared with doctor)
 *  - meetingEnabled:    true when T < 15 min (video panel activates)
 *  - isStarted:         true when T < 0 (appointment has begun)
 *  - isCompleted:       true when appointment status is 'completed'
 *  - formattedCountdown: "14m 30s" or "Started" display string
 *  - phase:             'waiting' | 'uploads-locked' | 'summary-locked' | 'active' | 'completed'
 */
export default function useConsultationTimer(appointmentDate, startTime, status = 'confirmed') {
	const [timerState, setTimerState] = useState(() => computeState(appointmentDate, startTime, status));
	const intervalRef = useRef(null);

	const computeStateMemo = useCallback(() => {
		return computeState(appointmentDate, startTime, status);
	}, [appointmentDate, startTime, status]);

	useEffect(() => {
		// Immediate calculation
		setTimerState(computeStateMemo());

		// Update every second for live countdown
		intervalRef.current = setInterval(() => {
			setTimerState(computeStateMemo());
		}, 1000);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [computeStateMemo]);

	return timerState;
}

function computeState(appointmentDate, startTime, status) {
	if (!appointmentDate || !startTime) {
		return getDefaultState();
	}

	if (status === 'completed') {
		return {
			minutesUntilStart: -Infinity,
			uploadsLocked: true,
			summaryLocked: true,
			meetingEnabled: false,
			isStarted: true,
			isCompleted: true,
			formattedCountdown: 'Completed',
			phase: 'completed',
			lockMessages: {
				uploads: 'This consultation has been completed.',
				summary: 'Summary has been finalized.',
				meeting: 'Meeting has ended.'
			}
		};
	}

	// Build appointment datetime
	const [hours, minutes] = startTime.split(':').map(Number);
	const aptDate = new Date(appointmentDate);
	aptDate.setHours(hours, minutes, 0, 0);

	const now = new Date();
	const diffMs = aptDate.getTime() - now.getTime();
	const diffMinutes = diffMs / 60000;

	const uploadsLocked = diffMinutes <= 15;
	const summaryLocked = diffMinutes <= 10;
	const meetingEnabled = diffMinutes <= 15 && diffMinutes > -120; // Enable 15 min before, disable 2 hrs after
	const isStarted = diffMinutes <= 0;
	const isCompleted = status === 'completed';

	// Determine phase
	let phase = 'waiting';
	if (isCompleted) phase = 'completed';
	else if (isStarted) phase = 'active';
	else if (summaryLocked) phase = 'summary-locked';
	else if (uploadsLocked) phase = 'uploads-locked';

	// Format countdown
	let formattedCountdown = '';
	if (isStarted) {
		const elapsedMin = Math.abs(Math.floor(diffMinutes));
		formattedCountdown = elapsedMin < 1 ? 'Just started' : `Started ${elapsedMin}m ago`;
	} else {
		const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
		const hrs = Math.floor(totalSeconds / 3600);
		const mins = Math.floor((totalSeconds % 3600) / 60);
		const secs = totalSeconds % 60;
		if (hrs > 0) {
			formattedCountdown = `${hrs}h ${mins}m ${secs}s`;
		} else if (mins > 0) {
			formattedCountdown = `${mins}m ${secs}s`;
		} else {
			formattedCountdown = `${secs}s`;
		}
	}

	// Lock messages
	const lockMessages = {
		uploads: uploadsLocked
			? '📎 Uploads are locked. You can no longer add records for this consultation.'
			: `📎 You can upload records for ${Math.floor(diffMinutes - 15)} more minutes.`,
		summary: summaryLocked
			? '🔒 Summary is locked and has been shared with your doctor.'
			: uploadsLocked
				? `📝 Summary will lock in ${Math.max(0, Math.floor(diffMinutes - 10))}m. Finalize your notes!`
				: '📝 You can edit your summary points until 10 minutes before the consultation.',
		meeting: meetingEnabled
			? '🎥 Meeting room is open. You can join now.'
			: `🎥 Meeting activates in ${Math.max(0, Math.floor(diffMinutes - 15))} minutes.`
	};

	return {
		minutesUntilStart: diffMinutes,
		uploadsLocked,
		summaryLocked,
		meetingEnabled,
		isStarted,
		isCompleted,
		formattedCountdown,
		phase,
		lockMessages
	};
}

function getDefaultState() {
	return {
		minutesUntilStart: Infinity,
		uploadsLocked: false,
		summaryLocked: false,
		meetingEnabled: false,
		isStarted: false,
		isCompleted: false,
		formattedCountdown: '--:--',
		phase: 'waiting',
		lockMessages: {
			uploads: '',
			summary: '',
			meeting: ''
		}
	};
}
