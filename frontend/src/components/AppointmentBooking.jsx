import { useState } from "react";
import apiService from "../services/api.js";
import AppointmentSuccess from "./AppointmentSuccess.jsx";
import "./AppointmentBooking.css";

const AppointmentBooking = ({ doctor, onClose, onSuccess }) => {
	const [selectedDate, setSelectedDate] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [reason, setReason] = useState("");
	const [notes, setNotes] = useState("");
	const [showSuccess, setShowSuccess] = useState(false);
	const [appointmentDetails, setAppointmentDetails] = useState(null);

	const timeSlots = [
		"9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
		"2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"
	];

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const appointmentData = {
				doctorId: doctor.id,
				date: selectedDate,
				time: selectedTime,
				reason,
				notes
			};
			
			// Check if in mock mode
			const token = localStorage.getItem('token');
			if (token === 'mock-token') {
				// Simulate API call delay
				await new Promise(resolve => setTimeout(resolve, 500));
				// Mock success
				if (onSuccess) {
					onSuccess();
				} else {
					setAppointmentDetails({ ...appointmentData, doctorName: doctor.name });
					setShowSuccess(true);
				}
			} else {
				await apiService.bookAppointment(appointmentData);
				if (onSuccess) {
					onSuccess();
				} else {
					setAppointmentDetails({ ...appointmentData, doctorName: doctor.name });
					setShowSuccess(true);
				}
			}
		} catch (error) {
			console.error('Booking error:', error);
			// Show error in a simple way without external toast
			alert('Failed to book appointment: ' + error.message);
		}
	};

	const handleViewAppointments = () => {
		setShowSuccess(false);
		onClose('appointments');
	};

	const handleBackToDashboard = () => {
		setShowSuccess(false);
		onClose();
	};

	if (showSuccess) {
		return (
			<AppointmentSuccess
				appointmentDetails={appointmentDetails}
				onViewAppointments={handleViewAppointments}
				onClose={handleBackToDashboard}
			/>
		);
	}

	return (
		<div className="booking-modal-overlay">
			<div className="booking-modal">
				<div className="booking-header">
					<h2 className="booking-title">Book Appointment</h2>
					<button onClick={onClose} className="close-btn">
						×
					</button>
				</div>

				<div className="doctor-info-panel">
					<h3 className="doctor-name">{doctor.name}</h3>
					<p className="doctor-specialty">{doctor.specialty}</p>
					<p className="doctor-experience">{doctor.experience}</p>
				</div>

				<form onSubmit={handleSubmit} className="booking-form">
					<div className="form-group">
						<label className="form-label">Select Date</label>
						<input
							type="date"
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.target.value)}
							min={new Date().toISOString().split('T')[0]}
							className="date-input"
							required
						/>
					</div>

					<div className="form-group">
						<label className="form-label">Select Time</label>
						<div className="time-slots-grid">
							{timeSlots.map(time => (
								<button
									key={time}
									type="button"
									onClick={() => setSelectedTime(time)}
									className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
								>
									{time}
								</button>
							))}
						</div>
					</div>

					<div className="form-group">
						<label className="form-label">Reason for Visit</label>
						<select
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="reason-select"
							required
						>
							<option value="">Select a reason</option>
							<option value="consultation">General Consultation</option>
							<option value="follow-up">Follow-up Visit</option>
							<option value="checkup">Regular Checkup</option>
							<option value="emergency">Emergency</option>
							<option value="other">Other</option>
						</select>
					</div>

					<div className="form-group">
						<label className="form-label">Additional Notes (Optional)</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
							className="notes-textarea"
							placeholder="Any additional information you'd like to share..."
						/>
					</div>

					<div className="booking-actions">
						<button type="button" onClick={onClose} className="cancel-btn">
							Cancel
						</button>
						<button 
							type="submit" 
							disabled={!selectedDate || !selectedTime || !reason}
							className="book-btn"
						>
							Book Appointment
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AppointmentBooking;
