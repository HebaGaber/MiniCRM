import React from 'react'
import * as LucideIcons from 'lucide-react'

type IconProps = {
  name: string
  size?: number
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function Icon({ name, size = 16, strokeWidth = 1.6, className, style }: IconProps) {
  const componentName = toPascalCase(name)
  const LucideIcon = LucideIcons[componentName as keyof typeof LucideIcons] as React.ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
    style?: React.CSSProperties
  }> | undefined

  if (!LucideIcon) return null

  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
    />
  )
}
