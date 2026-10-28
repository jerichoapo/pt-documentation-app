import React from 'react';
import Toast from './Toast';

const ToastContainer = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    // Top, just under the sticky header: the bottom of a phone screen holds
    // the tab bar and the wizard's Continue/Save bar, which a toast must not cover
    <div className="fixed z-50 space-y-2 top-16 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96">
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
