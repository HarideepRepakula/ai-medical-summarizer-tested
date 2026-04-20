import { useState } from "react";
import "./EmergencyRequest.css";

const EmergencyRequest = ({ onClose }) => {
	const [formData, setFormData] = useState({
		patientStatus: "",
		emergencyType: "",
		location: "",
		description: ""
	});
	const [isSubmitted, setIsSubmitted] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		// Simulate API call
		setTimeout(() => {
			setIsSubmitted(true);
		}, 1000);
	};

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value
		});
	};

	if (isSubmitted) {
		return (
			<div className="emergency-modal-overlay">
				<div className="emergency-modal">
					<div className="emergency-success">
						<div className="success-icon">✓</div>
						<h2 className="success-title">Emergency Requested Successfully</h2>
						<p className="success-message">
							Our emergency response team has been notified and will contact you shortly. 
							<strong> Stay calm and keep your line open.</strong>
						</p>
						<button onClick={onClose} className="success-btn">
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="emergency-modal-overlay">
			<div className="emergency-modal">
				<div className="emergency-header">
					<h2 className="emergency-title">🚨 Emergency Help Request</h2>
					<button onClick={onClose} className="emergency-close-btn">×</button>
				</div>

				<form onSubmit={handleSubmit} className="emergency-form">
					<p className="emergency-headline">Tell us what the emergency is.</p>

					<div className="form-group">
						<label className="form-label">Patient Status *</label>
						<select
							name="patientStatus"
							value={formData.patientStatus}
							onChange={handleChange}
							className="emergency-select"
							required
						>
							<option value="">Select patient status</option>
							<option value="myself">Myself</option>
							<option value="family">Family Member</option>
							<option value="other">Another Person</option>
						</select>
					</div>

					<div className="form-group">
						<label className="form-label">Emergency Type *</label>
						<div className="emergency-type-buttons">
							{["Injury", "Severe Pain", "Breathing Difficulty", "Mental Health Crisis", "Other"].map(type => (
								<button
									key={type}
									type="button"
									onClick={() => setFormData({...formData, emergencyType: type})}
									className={`emergency-type-btn ${formData.emergencyType === type ? 'selected' : ''}`}
								>
									{type}
								</button>
							))}
						</div>
					</div>

					<div className="form-group">
						<label className="form-label">Location *</label>
						<input
							type="text"
							name="location"
							value={formData.location}
							onChange={handleChange}
							placeholder="Current location or address"
							className="emergency-input"
							required
						/>
					</div>

					<div className="form-group">
						<label className="form-label">Description *</label>
						<textarea
							name="description"
							value={formData.description}
							onChange={handleChange}
							placeholder="Briefly describe the situation and symptoms"
							rows={4}
							className="emergency-textarea"
							required
						/>
					</div>

					<div className="emergency-actions">
						<button type="submit" className="emergency-submit-btn">
							Submit Emergency Request
						</button>
						<button type="button" onClick={onClose} className="emergency-cancel-btn">
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default EmergencyRequest;