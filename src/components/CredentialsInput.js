import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

const CredentialsInput = ({ credentials, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCredential();
    }
  };

  const addCredential = () => {
    const trimmedValue = inputValue.trim().toUpperCase();

    if (!trimmedValue) {
      return;
    }

    // Prevent duplicates
    if (credentials.includes(trimmedValue)) {
      setInputValue('');
      return;
    }

    const newCredentials = [...credentials, trimmedValue];
    onChange(newCredentials);
    setInputValue('');
  };

  const removeCredential = (indexToRemove) => {
    const newCredentials = credentials.filter((_, index) => index !== indexToRemove);
    onChange(newCredentials);
  };

  const handleInputFocus = () => {
    inputRef.current?.focus();
  };

  return (
    <div
      className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 cursor-text"
      onClick={handleInputFocus}
    >
      <div className="flex flex-wrap gap-1">
        {credentials.map((credential, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
          >
            {credential}
            <button
              type="button"
              onClick={() => removeCredential(index)}
              className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full text-blue-600 hover:bg-blue-200 hover:text-blue-800"
            >
              <X className="h-2.5 w-2.5" />
              <span className="sr-only">Remove {credential}</span>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-gray-500"
          placeholder={credentials.length === 0 ? "Add credential (press Enter)" : ""}
        />
      </div>
    </div>
  );
};

export default CredentialsInput;
