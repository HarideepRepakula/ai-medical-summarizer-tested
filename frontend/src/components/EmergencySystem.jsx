import { useState, useEffect } from 'react';
import { globalState } from '../services/globalState.js';
import './EmergencySystem.css';

// Emergency Alert Component for Doctor/Nurse Dashboards
export function EmergencyAlert({ userRole, userId, onAccept, onDecline }) {
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handleEmergencyAlert = (emergency) => {
      setEmergencyAlerts(prev => [emergency, ...prev]);
      setShowAlert(true);
      
      // Auto-hide after 10 seconds if not interacted with
      setTimeout(() => {
        setShowAlert(false);
      }, 10000);
    };

    globalState.subscribe('emergencyAlert', handleEmergencyAlert);
    globalState.subscribe('doctorNotification', handleEmergencyAlert);
    globalState.subscribe('nurseNotification', handleEmergencyAlert);

    return () => {
      globalState.unsubscribe('emergencyAlert', handleEmergencyAlert);
      globalState.unsubscribe('doctorNotification', handleEmergencyAlert);
      globalState.unsubscribe('nurseNotification', handleEmergencyAlert);
    };
  }, []);

  const handleAcceptEmergency = (emergency) => {
    globalState.acceptEmergency(emergency.id, userId, userId);
    setEmergencyAlerts(prev => prev.filter(e => e.id !== emergency.id));
    setShowAlert(false);
    if (onAccept) onAccept(emergency);
  };

  const handleDeclineEmergency = (emergency) => {
    setEmergencyAlerts(prev => prev.filter(e => e.id !== emergency.id));
    setShowAlert(false);
    if (onDecline) onDecline(emergency);
  };

  if (!showAlert || emergencyAlerts.length === 0) return null;

  const latestAlert = emergencyAlerts[0];

  return (
    <div className="emergency-alert-overlay">
      <div className="emergency-alert-modal">
        <div className="emergency-header">
          <h2>🚨 EMERGENCY ALERT</h2>
          <div className="emergency-timestamp">
            {new Date(latestAlert.timestamp).toLocaleTimeString()}
          </div>
        </div>
        
        <div className="emergency-content">
          <div className="patient-info">
            <h3>Patient: {latestAlert.patientName}</h3>
            <p><strong>Location:</strong> {latestAlert.location}</p>
            <p><strong>Condition:</strong> {latestAlert.condition}</p>
          </div>
          
          <div className="emergency-actions">
            <button 
              className="accept-emergency-btn"
              onClick={() => handleAcceptEmergency(latestAlert)}
            >
              Accept & Respond
            </button>
            <button 
              className="decline-emergency-btn"
              onClick={() => handleDeclineEmergency(latestAlert)}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Emergency Request Component for Patient Dashboard
export function EmergencyRequest({ patientId, patientName, onClose }) {
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitEmergency = () => {
    if (!location || !condition) return;
    
    setIsSubmitting(true);
    
    // Trigger emergency alert
    globalState.triggerEmergencyAlert({
      patientId,
      patientName,
      location,
      condition
    });
    
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      
      // Auto-close after showing success
      setTimeout(() => {
        onClose();
      }, 3000);
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="modal-overlay">
        <div className="emergency-request-modal">
          <div className="emergency-success">
            <div className="success-icon">✓</div>
            <h2>Emergency Alert Sent!</h2>
            <p>Medical professionals have been notified and will respond shortly.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="emergency-request-modal">
        <div className="modal-header emergency-header">
          <h2>🚨 Emergency Medical Help</h2>
        </div>
        
        <div className="modal-content">
          <div className="form-group">
            <label>Current Location *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter your current location"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Medical Condition/Emergency *</label>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Describe your emergency condition"
              rows={4}
              required
            />
          </div>
          
          <div className="emergency-info">
            <p><strong>What happens next:</strong></p>
            <ul>
              <li>Nearby doctors and nurses will be immediately notified</li>
              <li>Medical professionals can accept your emergency request</li>
              <li>You'll receive confirmation once help is on the way</li>
            </ul>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            className="submit-emergency-btn"
            onClick={handleSubmitEmergency}
            disabled={!location || !condition || isSubmitting}
          >
            {isSubmitting ? 'Sending Alert...' : 'Send Emergency Alert'}
          </button>
          <button 
            className="cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Emergency Status Component for Patient
export function EmergencyStatus({ patientId }) {
  const [emergencyStatus, setEmergencyStatus] = useState(null);

  useEffect(() => {
    const handleEmergencyAccepted = (emergency) => {
      if (emergency.patientId === patientId) {
        setEmergencyStatus(emergency);
      }
    };

    globalState.subscribe('emergencyAccepted', handleEmergencyAccepted);

    return () => {
      globalState.unsubscribe('emergencyAccepted', handleEmergencyAccepted);
    };
  }, [patientId]);

  if (!emergencyStatus) return null;

  return (
    <div className="emergency-status-banner">
      <div className="status-content">
        <span className="status-icon">🚑</span>
        <div className="status-text">
          <strong>Emergency Response Active</strong>
          <p>Medical help is on the way. Dr. {emergencyStatus.assignedDoctor} has accepted your request.</p>
        </div>
      </div>
    </div>
  );
}