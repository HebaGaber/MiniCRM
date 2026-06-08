import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UseFormReturn, FieldValues } from 'react-hook-form'
import type { ZodType } from 'zod'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'

// ── Re-exported form field primitives ─────────────────────────────────────────

type FieldShellProps = {
  label?: string
  required?: boolean
  error?: string
  help?: string
  children: React.ReactNode
}

function FieldShell({ label, required, error, help, children }: FieldShellProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-1-5)' }}>
      {label && (
        <span style={{ font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
          {label}
          {required && <span style={{ color: 'var(--iso-danger)', marginLeft: '2px' }}>*</span>}
        </span>
      )}
      {children}
      {(error ?? help) && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--iso-space-1)',
            font: '400 11px/1.3 var(--iso-font-ui)',
            color: error ? 'var(--iso-danger)' : 'var(--iso-fg-subtle)',
          }}
        >
          {error && <Icon name="alert-circle" size={12} strokeWidth={2} />}
          {error ?? help}
        </span>
      )}
    </label>
  )
}

function fieldBoxStyle(focused: boolean, error?: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--iso-space-2)',
    height: '38px',
    padding: '0 var(--iso-space-3)',
    border: `1px solid ${error ? 'var(--iso-danger)' : focused ? 'var(--iso-brand)' : 'var(--iso-border)'}`,
    borderRadius: 'var(--iso-radius-sm)',
    background: 'var(--iso-bg)',
    boxShadow: focused ? (error ? 'var(--iso-shadow-focus-danger)' : 'var(--iso-shadow-focus)') : 'none',
    transition: [
      'border-color var(--crm-fast) var(--crm-ease-standard)',
      'box-shadow var(--crm-fast) var(--crm-ease-standard)',
    ].join(', '),
  }
}

type TextFieldProps = {
  label?: string
  required?: boolean
  error?: string
  help?: string
  leadIcon?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  type?: string
  [key: string]: unknown
}

export function TextField({ label, required, error, help, leadIcon, value, onChange, placeholder, type = 'text', ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={fieldBoxStyle(focused, error)}>
        {leadIcon && <Icon name={leadIcon} size={15} style={{ color: 'var(--iso-fg-subtle)', flexShrink: 0 }} />}
        <input
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: 'transparent',
            font: '400 14px/1 var(--iso-font-body)',
            color: 'var(--iso-fg)',
            minWidth: 0,
          }}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </span>
    </FieldShell>
  )
}

type SelectOption = { value: string; label: string }

type SelectFieldProps = {
  label?: string
  required?: boolean
  error?: string
  help?: string
  value?: string
  onChange?: (value: string) => void
  options?: SelectOption[] | string[]
  placeholder?: string
  [key: string]: unknown
}

export function SelectField({ label, required, error, help, value, onChange, options = [], placeholder = 'Select…', ...rest }: SelectFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={{ ...fieldBoxStyle(focused, error), position: 'relative', padding: 0 }}>
        <select
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            height: '100%',
            border: 0,
            outline: 0,
            background: 'transparent',
            padding: '0 36px 0 var(--iso-space-3)',
            font: '400 14px/1 var(--iso-font-body)',
            color: value ? 'var(--iso-fg)' : 'var(--iso-fg-subtle)',
            appearance: 'none',
            cursor: 'pointer',
          }}
          {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(o => {
            const optValue = typeof o === 'string' ? o : o.value
            const optLabel = typeof o === 'string' ? o : o.label
            return <option key={optValue} value={optValue}>{optLabel}</option>
          })}
        </select>
        <Icon
          name="chevron-down"
          size={15}
          style={{
            position: 'absolute',
            right: 'var(--iso-space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--iso-fg-subtle)',
            pointerEvents: 'none',
          }}
        />
      </span>
    </FieldShell>
  )
}

type DateFieldProps = {
  label?: string
  required?: boolean
  error?: string
  help?: string
  value?: string
  onChange?: (value: string) => void
  [key: string]: unknown
}

export function DateField({ label, required, error, help, value, onChange, ...rest }: DateFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={fieldBoxStyle(focused, error)}>
        <Icon name="calendar" size={15} style={{ color: 'var(--iso-fg-subtle)', flexShrink: 0 }} />
        <input
          type="date"
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: 'transparent',
            font: '400 14px/1 var(--iso-font-body)',
            color: value ? 'var(--iso-fg)' : 'var(--iso-fg-subtle)',
          }}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </span>
    </FieldShell>
  )
}

// ── EntityForm template ────────────────────────────────────────────────────────

type EntityFormProps<TFormValues extends FieldValues> = {
  title: string
  noun: string
  schema: ZodType<TFormValues>
  defaultValues?: Partial<TFormValues>
  onSubmit: (values: TFormValues) => Promise<void> | void
  onCancel: () => void
  children: (form: UseFormReturn<TFormValues>) => React.ReactNode
  submitLabel?: string
  isSubmitting?: boolean
}

export function EntityForm<TFormValues extends FieldValues>({
  title,
  schema,
  defaultValues,
  onSubmit,
  onCancel,
  children,
  submitLabel = 'Save',
  isSubmitting,
}: EntityFormProps<TFormValues>) {
  const form = useForm<TFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues as any,
  })

  const handleSubmit = form.handleSubmit(async (values: TFormValues) => {
    await onSubmit(values)
  })

  return (
    <div
      style={{
        background: 'var(--iso-bg)',
        borderRadius: 'var(--iso-radius-lg)',
        border: '1px solid var(--iso-border)',
        boxShadow: 'var(--iso-shadow-xs)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--iso-space-5) var(--iso-space-6)',
          borderBottom: '1px solid var(--iso-border)',
        }}
      >
        <h2
          style={{
            margin: 0,
            font: '500 18px/1.3 var(--iso-font-display)',
            color: 'var(--iso-fg-strong)',
          }}
        >
          {title}
        </h2>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{
            padding: 'var(--iso-space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iso-space-5)',
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {children(form as any)}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--iso-space-2)',
            padding: 'var(--iso-space-4) var(--iso-space-6)',
            borderTop: '1px solid var(--iso-border-muted)',
            background: 'var(--iso-bg-subtle)',
          }}
        >
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmitting ?? form.formState.isSubmitting}
          >
            {(isSubmitting ?? form.formState.isSubmitting) ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
