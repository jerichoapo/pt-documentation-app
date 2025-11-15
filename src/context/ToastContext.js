import React, { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};
