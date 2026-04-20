import { useState, useEffect } from 'react';

let toastId = 0;
const toasts = [];
const listeners = [];

export const showToast = (message, type = 'success') => {
  const id = ++toastId;
  const toast = { id, message, type, timestamp: Date.now() };
  toasts.push(toast);
  listeners.forEach(listener => listener([...toasts]));
  
  setTimeout(() => {
    const index = toasts.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.splice(index, 1);
      listeners.forEach(listener => listener([...toasts]));
    }
  }, 4000);
};

export const NotificationToast = () => {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const listener = (newToasts) => setToastList(newToasts);
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}>
      {toastList.map(toast => (
        <div 
          key={toast.id}
          style={{
            background: toast.type === 'error' ? '#EF4444' : 
                       toast.type === 'warning' ? '#F59E0B' :
                       toast.type === 'info' ? '#3B82F6' : '#10B981',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '0.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontWeight: '500',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
