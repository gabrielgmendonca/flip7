import React, { useState, useEffect } from 'react';
import './ValidatedInput.css';

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  rules?: ValidationRule[];
  showValidation?: boolean;
  label?: string;
}

export function ValidatedInput({
  value,
  onChange,
  rules = [],
  showValidation = true,
  label,
  ...inputProps
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!touched || !showValidation) {
      setError(null);
      return;
    }

    for (const rule of rules) {
      if (!rule.validate(value)) {
        setError(rule.message);
        return;
      }
    }
    setError(null);
  }, [value, touched, rules, showValidation]);

  const isValid = touched && value.length > 0 && !error;
  const isInvalid = touched && error !== null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <div className="validated-input-container">
      {label && <label>{label}</label>}
      <div className="validated-input-wrapper">
        <input
          {...inputProps}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`${inputProps.className || ''} ${isValid ? 'valid' : ''} ${isInvalid ? 'invalid' : ''}`}
        />
        {showValidation && touched && (
          <span className={`validation-icon ${isValid ? 'valid' : ''} ${isInvalid ? 'invalid' : ''}`}>
            {isValid ? '\u2713' : isInvalid ? '\u2717' : ''}
          </span>
        )}
      </div>
      {showValidation && (
        <div className="validation-error">{isInvalid ? error : ''}</div>
      )}
    </div>
  );
}

export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),
  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.trim().length >= min,
    message: message || `Must be at least ${min} characters`,
  }),
  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.trim().length <= max,
    message: message || `Must be at most ${max} characters`,
  }),
  noSpecialChars: (message = 'No special characters allowed'): ValidationRule => ({
    validate: (value) => /^[a-zA-Z0-9\s]*$/.test(value),
    message,
  }),
  numberRange: (min: number, max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      const num = parseInt(value, 10);
      return !isNaN(num) && num >= min && num <= max;
    },
    message: message || `Must be between ${min} and ${max}`,
  }),
};
