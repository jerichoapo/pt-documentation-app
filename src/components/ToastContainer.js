import React from 'react';
import Toast from './Toast';

const ToastContainer = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-50 space-y-2 inset-x-4 bottom-20 sm:inset-x-auto sm:bottom-auto sm:top-4 sm:right-4 sm:w-96">
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
