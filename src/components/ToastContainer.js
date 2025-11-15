import React from 'react';
import Toast from './Toast';

const ToastContainer = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={onClose}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
