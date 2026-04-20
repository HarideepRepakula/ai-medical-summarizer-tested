import { useState, useEffect } from 'react';
import { globalState } from '../services/globalState.js';
import './AIFeatures.css';

// AI Medical Summary Component
export function AIMedicalSummary({ patientId, consultationType = 'general' }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate AI summary
    setLoading(true);
    setTimeout(() => {
      const aiSummary = globalState.generateAISummary(patientId, consultationType);
      setSummary(aiSummary);
      setLoading(false);
    }, 2000);
  }, [patientId, consultationType]);

  if (loading) {
    return (
      <div className="ai-summary-container">
        <div className="ai-summary-header">
          <h3>🤖 AI Medical Summary</h3>
          <div className="ai-loading">Analyzing patient data...</div>
        </div>
        <div className="ai-loading-animation">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-summary-container">
      <div className="ai-summary-header">
        <h3>🤖 AI Medical Summary</h3>
        <div className={`risk-level ${summary.riskLevel}`}>
          Risk Level: {summary.riskLevel.toUpperCase()}
        </div>
      </div>
      
      <div className="ai-summary-content">
        <div className="summary-text">
          <p>{summary.summary}</p>
        </div>
        
        <div className="ai-recommendations">
          <h4>AI Recommendations:</h4>
          <ul>
            {summary.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
        
        <div className="summary-timestamp">
          Generated: {new Date(summary.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// Wearable Data Widget
export function WearableDataWidget({ patientId }) {
  const [wearableData, setWearableData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate wearable connection
    setTimeout(() => {
      setIsConnected(true);
      // Initialize with mock data
      globalState.updateWearableData(patientId, {
        heartRate: 72 + Math.floor(Math.random() * 20),
        bloodPressure: { 
          systolic: 120 + Math.floor(Math.random() * 20), 
          diastolic: 80 + Math.floor(Math.random() * 10) 
        },
        oxygenLevel: 95 + Math.floor(Math.random() * 5),
        steps: 5000 + Math.floor(Math.random() * 3000),
        sleepHours: 6 + Math.random() * 3
      });
    }, 1000);

    // Listen for wearable data updates
    const handleWearableUpdate = (data) => {
      if (data.patientId === patientId) {
        setWearableData(data.data);
      }
    };

    globalState.subscribe('wearableDataUpdated', handleWearableUpdate);

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (isConnected) {
        globalState.updateWearableData(patientId, {
          heartRate: 70 + Math.floor(Math.random() * 30),
          steps: (wearableData?.steps || 5000) + Math.floor(Math.random() * 100)
        });
      }
    }, 10000);

    return () => {
      globalState.unsubscribe('wearableDataUpdated', handleWearableUpdate);
      clearInterval(interval);
    };
  }, [patientId, isConnected, wearableData?.steps]);

  if (!isConnected) {
    return (
      <div className="wearable-widget">
        <div className="wearable-header">
          <h3>⌚ Wearable Device</h3>
          <div className="connection-status connecting">Connecting...</div>
        </div>
        <div className="connection-animation">
          <div className="pulse-ring"></div>
          <div className="pulse-ring delay-1"></div>
          <div className="pulse-ring delay-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="wearable-widget">
      <div className="wearable-header">
        <h3>⌚ Live Health Data</h3>
        <div className="connection-status connected">Connected</div>
      </div>
      
      {wearableData && (
        <div className="vitals-grid">
          <div className="vital-card heart-rate">
            <div className="vital-icon">❤️</div>
            <div className="vital-value">{wearableData.heartRate}</div>
            <div className="vital-label">BPM</div>
          </div>
          
          <div className="vital-card blood-pressure">
            <div className="vital-icon">🩸</div>
            <div className="vital-value">
              {wearableData.bloodPressure?.systolic}/{wearableData.bloodPressure?.diastolic}
            </div>
            <div className="vital-label">mmHg</div>
          </div>
          
          <div className="vital-card oxygen">
            <div className="vital-icon">🫁</div>
            <div className="vital-value">{wearableData.oxygenLevel}%</div>
            <div className="vital-label">SpO2</div>
          </div>
          
          <div className="vital-card steps">
            <div className="vital-icon">👟</div>
            <div className="vital-value">{wearableData.steps?.toLocaleString()}</div>
            <div className="vital-label">Steps</div>
          </div>
        </div>
      )}
      
      <div className="last-sync">
        Last sync: {wearableData ? new Date(wearableData.lastUpdated).toLocaleTimeString() : 'Never'}
      </div>
    </div>
  );
}

// Automated Report Upload Component
export function AutoReportUpload({ patientId }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundReports, setFoundReports] = useState([]);

  const searchReports = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return;
    
    setIsSearching(true);
    
    // Simulate API call to fetch reports by phone number
    setTimeout(() => {
      const mockReports = [
        {
          id: 1,
          type: 'Blood Test',
          date: '2024-01-10',
          lab: 'City Lab',
          fileName: 'blood_test_results.pdf',
          status: 'available'
        },
        {
          id: 2,
          type: 'X-Ray',
          date: '2024-01-08',
          lab: 'Radiology Center',
          fileName: 'chest_xray.jpg',
          status: 'available'
        }
      ];
      
      setFoundReports(mockReports);
      setIsSearching(false);
      
      // Auto-add to medical records
      mockReports.forEach(report => {
        globalState.syncDashboards('medicalRecord', {
          patientId,
          record: {
            ...report,
            autoUploaded: true,
            uploadedAt: new Date().toISOString()
          }
        });
      });
    }, 3000);
  };

  return (
    <div className="auto-report-upload">
      <div className="upload-header">
        <h3>📄 Automated Report Retrieval</h3>
        <p>Enter your phone number to automatically fetch available medical reports</p>
      </div>
      
      <div className="phone-input-section">
        <div className="input-group">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number"
            maxLength={10}
          />
          <button 
            onClick={searchReports}
            disabled={phoneNumber.length < 10 || isSearching}
            className="search-reports-btn"
          >
            {isSearching ? 'Searching...' : 'Search Reports'}
          </button>
        </div>
      </div>
      
      {isSearching && (
        <div className="search-animation">
          <div className="search-progress">
            <div className="progress-bar"></div>
          </div>
          <p>Searching medical databases...</p>
        </div>
      )}
      
      {foundReports.length > 0 && (
        <div className="found-reports">
          <h4>✅ Found Reports:</h4>
          <div className="reports-list">
            {foundReports.map(report => (
              <div key={report.id} className="report-item">
                <div className="report-info">
                  <strong>{report.type}</strong>
                  <span>{report.date} - {report.lab}</span>
                </div>
                <div className="report-status">Auto-Added</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// AI Health Chatbot
export function AIHealthChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Hello! I\'m your AI health assistant. How can I help you today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const sendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMessage = { type: 'user', text: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    
    // Simulate AI response
    setTimeout(() => {
      const botResponse = generateAIResponse(inputMessage);
      setMessages(prev => [...prev, { type: 'bot', text: botResponse }]);
    }, 1000);
    
    setInputMessage('');
  };

  const generateAIResponse = (message) => {
    const responses = {
      'headache': 'For headaches, try resting in a dark room, staying hydrated, and consider over-the-counter pain relief. If severe or persistent, consult a doctor.',
      'fever': 'For fever, rest, stay hydrated, and monitor your temperature. Seek medical attention if fever exceeds 103°F or persists.',
      'cough': 'For cough, try warm liquids, honey, and humidified air. If persistent or with other symptoms, consult a healthcare provider.',
      'default': 'I understand your concern. For personalized medical advice, I recommend consulting with a healthcare professional. Is there anything specific about your symptoms you\'d like to discuss?'
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }
    return responses.default;
  };

  return (
    <>
      <button 
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        🤖
      </button>
      
      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <h3>AI Health Assistant</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                {message.text}
              </div>
            ))}
          </div>
          
          <div className="chatbot-input">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about your health..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}