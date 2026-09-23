"use client";

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

// Adapted API from magkam-solutions/web-app/components/ui/{Button,Input}.tsx.
export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      className={`button ${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? "Saving…" : children}
    </button>
  );
}

export function Input({
  label,
  error,
  helperText,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
      />
      {(error || helperText) && (
        <p
          id={`${inputId}-hint`}
          className={error ? "field-error" : "field-hint"}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  error,
  helperText,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  helperText?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <textarea
        {...props}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
      />
      {(error || helperText) && (
        <p
          id={`${inputId}-hint`}
          className={error ? "field-error" : "field-hint"}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "gold";
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ArtworkMark({
  title,
  large = false,
}: {
  title: string;
  large?: boolean;
}) {
  return (
    <div className={`artwork-mark ${large ? "large" : ""}`} aria-hidden="true">
      <span className="registration top-left" />
      <span className="registration bottom-right" />
      <span className="mark-letter">
        {title.trim().slice(0, 1).toUpperCase() || "S"}
      </span>
      <span className="mark-caption">Preview image pending</span>
    </div>
  );
}
