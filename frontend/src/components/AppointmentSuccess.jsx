import { useState } from "react";
import "./AppointmentSuccess.css";

// Patient Medical Journey Modal Component
const PatientMedicalJourney = ({ patient, onClose }) => {
	const [activeTab, setActiveTab] = useState('overview');
	
	return (
		<div className="modal-overlay">
			<div className="patient-journey-modal">
				<div className="journey-header">
					<h2>{patient.name}: Full Medical Journey</h2>
					<button onClick={onClose} className="close-btn">×</button>
				</div>
				<div className="journey-tabs">
					<button 
						className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
						onClick={() => setActiveTab('overview')}
					>
						Health Overview
					</button>
					<button 
						className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
						onClick={() => setActiveTab('appointments')}
					>
						Appointments
					</button>
					<button 
						className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
						onClick={() => setActiveTab('reports')}
					>
						Reports & Results
					</button>
				</div>
				<div className="journey-content">
					{activeTab === 'overview' && (
						<div className="overview-content">
							<p><strong>Age:</strong> {patient.age || 'N/A'}</p>
							<p><strong>Condition:</strong> {patient.condition || 'N/A'}</p>
							<p><strong>Last Visit:</strong> {patient.lastVisit || 'N/A'}</p>
						</div>
					)}
					{activeTab === 'appointments' && (
						<div className="appointments-content">
							<p>Appointment history would be displayed here</p>
						</div>
					)}
					{activeTab === 'reports' && (
						<div className="reports-content">
							<p>Medical reports and test results would be displayed here</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

// Prescription Modal Component
const PrescriptionModal = ({ patient, onClose, onSubmit }) => {
	const [prescription, setPrescription] = useState({
		medication: '',
		dosage: '',
		frequency: '',
		instructions: ''
	});
	
	const handleSubmit = (e) => {
		e.preventDefault();
		onSubmit(prescription);
	};
	
	return (
		<div className="modal-overlay">
			<div className="prescription-modal">
				<div className="prescription-header">
					<h2>New Prescription for {patient.name}</h2>
					<button onClick={onClose} className="close-btn">×</button>
				</div>
				<form onSubmit={handleSubmit} className="prescription-form">
					<div className="form-group">
						<label>Medication</label>
						<input 
							type="text" 
							value={prescription.medication}
							onChange={(e) => setPrescription({...prescription, medication: e.target.value})}
							required 
						/>
					</div>
					<div className="form-group">
						<label>Dosage</label>
						<input 
							type="text" 
							value={prescription.dosage}
							onChange={(e) => setPrescription({...prescription, dosage: e.target.value})}
							required 
						/>
					</div>
					<div className="form-group">
						<label>Frequency</label>
						<input 
							type="text" 
							value={prescription.frequency}
							onChange={(e) => setPrescription({...prescription, frequency: e.target.value})}
							required 
						/>
					</div>
					<div className="form-group">
						<label>Instructions</label>
						<textarea 
							value={prescription.instructions}
							onChange={(e) => setPrescription({...prescription, instructions: e.target.value})}
							rows={3}
						/>
					</div>
					<div className="prescription-actions">
						<button type="submit" className="primary-action-btn">Submit Prescription</button>
						<button type="button" onClick={onClose} className="secondary-action-btn">Cancel</button>
					</div>
				</form>
			</div>
		</div>
	);
};

const AppointmentSuccess = ({ appointmentDetails, onViewAppointments, onClose, onUploadRecords }) => {
	return (
		<div className="success-modal-overlay">
			<div className="success-modal">
				<div className="booking-success-content">
					<div className="booking-success-icon">📅</div>
					<h1 className="booking-success-title">🎉 Appointment Successfully Booked!</h1>
					<p className="booking-primary-message">Your appointment has been confirmed</p>
					<p className="booking-secondary-message">
						You will receive a confirmation email shortly with all the details.
					</p>
					<p className="booking-action-prompt">
						Would you like to upload any relevant medical records for the doctor now?
					</p>
					<div className="booking-success-actions">
						<button onClick={onUploadRecords || (() => {})} className="booking-primary-btn">
							Upload Medical Records
						</button>
						<button onClick={onViewAppointments} className="booking-secondary-btn">
							Skip / View Appointments
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AppointmentSuccess;
export { PatientMedicalJourney, PrescriptionModal };