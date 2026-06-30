import { useState } from 'react';

export function FieldError({ id, error }) {
  if (!error) return null;
  return (
    <div id={id} className="invalid-feedback d-block" role="alert">
      {error}
    </div>
  );
}

export function FormAlert({ message, tone = 'error' }) {
  if (!message) return null;
  const className = tone === 'success' ? 'alert alert-success py-2 mb-0' : 'alert alert-danger py-2 mb-0';
  return <div className={className} role="alert">{message}</div>;
}

export function TextField({
  id,
  label,
  type = 'text',
  register,
  placeholder,
  autoComplete,
  error,
  showPasswordToggle = false,
  floating = true,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const canTogglePassword = showPasswordToggle && type === 'password';
  const inputType = canTogglePassword ? (showPassword ? 'text' : 'password') : type;
  const errorId = `${id}-error`;

  if (!floating) {
    return (
      <div className="sv-input-field position-relative">
        <div className={`sv-field-control ${canTogglePassword ? 'has-password-toggle' : ''}`}>
          <input
            id={id}
            type={inputType}
            className={`form-control ${error ? 'is-invalid' : ''}`}
            placeholder={placeholder || label}
            autoComplete={autoComplete}
            aria-label={label}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            {...register}
          />
          {canTogglePassword ? (
            <button
              type="button"
              className="btn btn-sm sv-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <FieldError id={errorId} error={error} />
      </div>
    );
  }

  return (
    <div className="form-floating sv-floating-field">
      <div className={`sv-field-control ${canTogglePassword ? 'has-password-toggle' : ''}`}>
        <input
          id={id}
          type={inputType}
          className={`form-control ${error ? 'is-invalid' : ''}`}
          placeholder={placeholder || label}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...register}
        />
        <label htmlFor={id}>{label}</label>
        {canTogglePassword ? (
          <button
            type="button"
            className="btn btn-sm sv-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}
