// System Integration Utilities for MedHub
import { globalState } from '../services/globalState.js';

// Initialize complete system integration
export const initializeSystem = () => {
  // Set up cross-dashboard event listeners
  setupCrossDashboardSync();
  
  // Initialize responsive design handlers
  setupResponsiveHandlers();
  
  // Set up real-time updates
  setupRealTimeUpdates();
  
  // Initialize accessibility features
  setupAccessibilityFeatures();
  
  console.log('MedHub System Integration Initialized');
};

// Cross-dashboard synchronization
const setupCrossDashboardSync = () => {
  // Appointment updates sync across all dashboards
  globalState.subscribe('appointmentBooked', (appointment) => {
    broadcastUpdate('appointment', 'booked', appointment);
  });

  globalState.subscribe('appointmentRescheduled', (appointment) => {
    broadcastUpdate('appointment', 'rescheduled', appointment);
  });

  globalState.subscribe('appointmentCompleted', (appointment) => {
    broadcastUpdate('appointment', 'completed', appointment);
  });

  globalState.subscribe('appointmentCancelled', (appointment) => {
    broadcastUpdate('appointment', 'cancelled', appointment);
  });

  // Prescription updates
  globalState.subscribe('prescriptionCreated', (prescription) => {
    broadcastUpdate('prescription', 'created', prescription);
  });

  // Pharmacy order updates
  globalState.subscribe('pharmacyOrderCreated', (order) => {
    broadcastUpdate('pharmacy', 'orderCreated', order);
  });

  globalState.subscribe('pharmacyOrderUpdated', (order) => {
    broadcastUpdate('pharmacy', 'orderUpdated', order);
  });

  // Emergency alerts
  globalState.subscribe('emergencyAlert', (emergency) => {
    broadcastUpdate('emergency', 'alert', emergency);
  });

  // Medical records
  globalState.subscribe('recordAdded', (record) => {
    broadcastUpdate('records', 'added', record);
  });

  globalState.subscribe('recordDeleted', (recordId) => {
    broadcastUpdate('records', 'deleted', { id: recordId });
  });
};

// Broadcast updates to all connected components
const broadcastUpdate = (category, action, data) => {
  window.dispatchEvent(new CustomEvent('systemUpdate', {
    detail: { category, action, data, timestamp: new Date().toISOString() }
  }));
};

// Responsive design handlers
const setupResponsiveHandlers = () => {
  let resizeTimer;
  
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isMobile = window.innerWidth <= 768;
      const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
      
      document.body.classList.toggle('mobile-layout', isMobile);
      document.body.classList.toggle('tablet-layout', isTablet);
      
      // Emit resize event for components
      window.dispatchEvent(new CustomEvent('layoutChange', {
        detail: { isMobile, isTablet, width: window.innerWidth }
      }));
    }, 250);
  };

  window.addEventListener('resize', handleResize);
  handleResize(); // Initial call
};

// Real-time updates simulation
const setupRealTimeUpdates = () => {
  // Simulate real-time data updates every 30 seconds
  setInterval(() => {
    // Update wearable data for patients
    const patients = globalState.state.patients;
    patients.forEach(patient => {
      const vitals = generateMockVitals();
      globalState.updateWearableData(patient.id, vitals);
    });

    // Check for emergency conditions
    checkEmergencyConditions();
  }, 30000);
};

// Generate mock vital signs
const generateMockVitals = () => {
  return {
    heartRate: Math.floor(Math.random() * 40) + 60, // 60-100 bpm
    bloodPressure: {
      systolic: Math.floor(Math.random() * 40) + 110, // 110-150
      diastolic: Math.floor(Math.random() * 20) + 70   // 70-90
    },
    oxygenLevel: Math.floor(Math.random() * 5) + 95,   // 95-100%
    temperature: (Math.random() * 2 + 97).toFixed(1),  // 97-99°F
    timestamp: new Date().toISOString()
  };
};

// Check for emergency conditions
const checkEmergencyConditions = () => {
  const patients = globalState.state.patients;
  
  patients.forEach(patient => {
    const vitals = globalState.state.wearableData[patient.id];
    if (vitals && globalState.checkAbnormalVitals(vitals)) {
      // Trigger emergency alert
      globalState.triggerEmergencyAlert({
        patientId: patient.id,
        patientName: patient.name,
        location: 'Home (Wearable Device)',
        condition: 'Abnormal Vitals Detected',
        vitals: vitals
      });
    }
  });
};

// Accessibility features
const setupAccessibilityFeatures = () => {
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // ESC key closes modals
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.modal-overlay');
      modals.forEach(modal => {
        if (modal.style.display !== 'none') {
          const closeBtn = modal.querySelector('.close-btn, .cancel-btn');
          if (closeBtn) closeBtn.click();
        }
      });
    }
  });

  // High contrast mode detection
  if (window.matchMedia('(prefers-contrast: high)').matches) {
    document.body.classList.add('high-contrast');
  }

  // Reduced motion detection
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('reduced-motion');
  }
};

// Navigation utilities
export const navigateToSection = (dashboardType, section) => {
  const event = new CustomEvent('navigationRequest', {
    detail: { dashboardType, section }
  });
  window.dispatchEvent(event);
};

// Data validation utilities
export const validateFormData = (data, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const rule = rules[field];
    const value = data[field];
    
    if (rule.required && (!value || value.trim() === '')) {
      errors[field] = `${field} is required`;
    }
    
    if (rule.minLength && value && value.length < rule.minLength) {
      errors[field] = `${field} must be at least ${rule.minLength} characters`;
    }
    
    if (rule.pattern && value && !rule.pattern.test(value)) {
      errors[field] = rule.message || `${field} format is invalid`;
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// File handling utilities
export const handleFileUpload = (file, allowedTypes = ['pdf', 'jpg', 'jpeg', 'png']) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }
    
    const fileType = file.type.split('/')[1];
    if (!allowedTypes.includes(fileType)) {
      reject(new Error(`File type ${fileType} not allowed`));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        fileName: file.name,
        fileType: fileType,
        fileData: e.target.result,
        fileSize: file.size
      });
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsDataURL(file);
  });
};

// Date and time utilities
export const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString();
    case 'long':
      return d.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'time':
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    case 'datetime':
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    default:
      return d.toLocaleDateString();
  }
};

// Search and filter utilities
export const searchAndFilter = (items, searchTerm, filterCriteria = {}) => {
  return items.filter(item => {
    // Search term matching
    const searchMatch = !searchTerm || 
      Object.values(item).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    // Filter criteria matching
    const filterMatch = Object.keys(filterCriteria).every(key => {
      const filterValue = filterCriteria[key];
      return !filterValue || item[key] === filterValue;
    });
    
    return searchMatch && filterMatch;
  });
};

// Export all utilities
export default {
  initializeSystem,
  navigateToSection,
  validateFormData,
  handleFileUpload,
  formatDate,
  searchAndFilter
};