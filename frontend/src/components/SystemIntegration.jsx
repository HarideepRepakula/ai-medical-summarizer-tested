import { useEffect, useState } from 'react';
import { globalState } from '../services/globalState.js';

// Mobile Navigation Component
export const MobileNavigation = ({ isOpen, onToggle, onClose }) => {
  return (
    <>
      <div className="mobile-header show-mobile">
        <button className="hamburger-btn" onClick={onToggle}>
          ☰
        </button>
        <h1>MedHub</h1>
        <div></div>
      </div>
      {isOpen && (
        <div className="mobile-nav-overlay active" onClick={onClose}></div>
      )}
    </>
  );
};

// Real-time Notification System
export const NotificationSystem = ({ userId, userRole }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNotification = (notification) => {
      if (notification.userId === userId || notification.broadcast) {
        setNotifications(prev => [notification, ...prev.slice(0, 4)]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
      }
    };

    globalState.subscribe('notificationSent', handleNotification);
    return () => globalState.unsubscribe('notificationSent', handleNotification);
  }, [userId]);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          <div className="notification-content">
            <span className="notification-message">{notification.message}</span>
            <button 
              className="notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Cross-Dashboard Data Sync
export const DataSyncProvider = ({ children }) => {
  useEffect(() => {
    const handleDashboardSync = (syncData) => {
      // Broadcast updates to all connected components
      window.dispatchEvent(new CustomEvent('dashboardUpdate', { 
        detail: syncData 
      }));
    };

    globalState.subscribe('dashboardSync', handleDashboardSync);
    return () => globalState.unsubscribe('dashboardSync', handleDashboardSync);
  }, []);

  return children;
};

// Responsive Layout Manager
export const ResponsiveLayoutManager = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`layout-container ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
      {children}
    </div>
  );
};

// Search and Filter Component
export const SearchAndFilter = ({ 
  searchTerm, 
  onSearchChange, 
  filterOptions = [], 
  selectedFilter, 
  onFilterChange,
  placeholder = "Search..." 
}) => {
  return (
    <div className="search-filter-container">
      <div className="search-input-container">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <button className="search-btn">🔍</button>
      </div>
      {filterOptions.length > 0 && (
        <select
          value={selectedFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="">All</option>
          {filterOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

// Loading Overlay Component
export const LoadingOverlay = ({ isLoading, message = "Loading..." }) => {
  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
};

// Error Boundary Component
export const ErrorBoundary = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (event) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return fallback || (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>{error?.message || 'An unexpected error occurred'}</p>
        <button onClick={() => {
          setHasError(false);
          setError(null);
        }}>
          Try Again
        </button>
      </div>
    );
  }

  return children;
};

// Status Badge Component
export const StatusBadge = ({ status, type = 'appointment' }) => {
  const getStatusConfig = () => {
    const configs = {
      appointment: {
        confirmed: { label: 'CONFIRMED', color: 'green' },
        pending: { label: 'PENDING', color: 'orange' },
        'reschedule-requested': { label: 'RESCHEDULE REQUESTED', color: 'purple' },
        'awaiting-patient-action': { label: 'AWAITING PATIENT ACTION', color: 'purple' },
        completed: { label: 'COMPLETED', color: 'green' },
        cancelled: { label: 'CANCELLED', color: 'red' }
      },
      order: {
        pending: { label: 'PENDING', color: 'orange' },
        processing: { label: 'PROCESSING', color: 'blue' },
        ready: { label: 'READY', color: 'green' },
        delivered: { label: 'DELIVERED', color: 'green' }
      },
      inventory: {
        'in-stock': { label: 'IN STOCK', color: 'green' },
        'low-stock': { label: 'LOW STOCK', color: 'orange' },
        critical: { label: 'CRITICAL', color: 'red' }
      }
    };

    return configs[type]?.[status] || { label: status.toUpperCase(), color: 'gray' };
  };

  const config = getStatusConfig();

  return (
    <span className={`status-badge ${config.color} ${status}`}>
      {config.label}
    </span>
  );
};

// Confirmation Modal Component
export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  type = "default" 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`confirmation-modal ${type}`}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-content">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button 
            className={`confirm-btn ${type}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button 
            className="cancel-btn"
            onClick={onClose}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast Notification Hook
export const useToast = () => {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  };

  const ToastComponent = () => {
    if (!toast) return null;
    
    return (
      <div className={`toast ${toast.type}`}>
        {toast.message}
      </div>
    );
  };

  return { showToast, ToastComponent };
};

// Form Validation Hook
export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);

  const validate = (fieldName, value) => {
    const rule = validationRules[fieldName];
    if (!rule) return '';

    if (rule.required && (!value || value.trim() === '')) {
      return `${fieldName} is required`;
    }

    if (rule.minLength && value.length < rule.minLength) {
      return `${fieldName} must be at least ${rule.minLength} characters`;
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.message || `${fieldName} format is invalid`;
    }

    return '';
  };

  const setValue = (fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    const error = validate(fieldName, value);
    setErrors(prev => ({ ...prev, [fieldName]: error }));
    
    // Check overall form validity
    const newErrors = { ...errors, [fieldName]: error };
    const hasErrors = Object.values(newErrors).some(error => error !== '');
    setIsValid(!hasErrors);
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(validationRules).forEach(fieldName => {
      newErrors[fieldName] = validate(fieldName, values[fieldName]);
    });
    
    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some(error => error !== '');
    setIsValid(!hasErrors);
    
    return !hasErrors;
  };

  return {
    values,
    errors,
    isValid,
    setValue,
    validateAll,
    setValues
  };
};

// Export all components and hooks
export default {
  MobileNavigation,
  NotificationSystem,
  DataSyncProvider,
  ResponsiveLayoutManager,
  SearchAndFilter,
  LoadingOverlay,
  ErrorBoundary,
  StatusBadge,
  ConfirmationModal,
  useToast,
  useFormValidation
};