import React from 'react'

type SkeletonProps = {
  w?: string | number
  h?: number
  r?: number
  style?: React.CSSProperties
}

export function Skeleton({ w = '100%', h = 12, r = 4, style }: SkeletonProps) {
  return (
    <span
      className="crm-skel"
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: `${h}px`,
        borderRadius: `${r}px`,
        ...style,
      }}
    />
  )
}
