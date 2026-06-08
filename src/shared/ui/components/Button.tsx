import React from 'react'
import { Icon } from './Icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'neutral'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  leadIcon?: string
  trailIcon?: string
  disabled?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'>

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  lg: { height: '44px', padding: '0 18px', fontSize: '14px', minWidth: '110px' },
  md: { height: '36px', padding: '0 14px', fontSize: '13px', minWidth: '84px' },
  sm: { height: '28px', padding: '0 11px', fontSize: '12px', minWidth: '0' },
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: 'var(--iso-brand)', color: 'var(--iso-fg-on-brand)', boxShadow: 'var(--iso-shadow-xs)', borderColor: 'transparent' },
  secondary: { background: 'var(--iso-bg)', color: 'var(--iso-brand)', borderColor: 'var(--iso-brand)' },
  ghost:     { background: 'transparent', color: 'var(--iso-fg-muted)', borderColor: 'transparent' },
  danger:    { background: 'var(--iso-danger)', color: 'var(--iso-fg-on-brand)', boxShadow: 'var(--iso-shadow-xs)', borderColor: 'transparent' },
  neutral:   { background: 'var(--iso-n-100)', color: 'var(--iso-fg)', borderColor: 'transparent' },
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', leadIcon, trailIcon, disabled, children, style, ...rest }, ref) => {
    const iconSize = size === 'sm' ? 13 : 15

    const disabledStyle: React.CSSProperties =
      disabled
        ? variant === 'secondary' || variant === 'ghost'
          ? { color: 'var(--iso-fg-disabled)', borderColor: 'var(--iso-border)', background: 'var(--iso-bg)' }
          : { background: 'var(--iso-blue-1-200)', color: 'var(--iso-fg-on-brand)', boxShadow: 'none' }
        : {}

    return (
      <button
        ref={ref}
        disabled={disabled}
        {...rest}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          borderRadius: 'var(--iso-radius-sm)',
          fontFamily: 'var(--iso-font-body)',
          fontWeight: 500,
          cursor: disabled ? 'default' : 'pointer',
          border: '1px solid transparent',
          whiteSpace: 'nowrap',
          transition: [
            'color var(--crm-fast) var(--crm-ease-standard)',
            'border-color var(--crm-fast) var(--crm-ease-standard)',
            'box-shadow var(--crm-fast) var(--crm-ease-standard)',
          ].join(', '),
          ...SIZE_STYLES[size],
          ...VARIANT_STYLES[variant],
          ...disabledStyle,
          ...style,
        }}
      >
        {leadIcon && <Icon name={leadIcon} size={iconSize} />}
        {children}
        {trailIcon && <Icon name={trailIcon} size={iconSize} />}
      </button>
    )
  },
)

Button.displayName = 'Button'
