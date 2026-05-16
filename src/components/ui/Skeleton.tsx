type Variant = 'text' | 'row' | 'card' | 'circle'

interface SkeletonProps {
  variant?: Variant
  className?: string
  width?: string | number
  height?: string | number
}

const baseClass = 'animate-pulse bg-gray-200 rounded'

export function Skeleton({ variant = 'text', className = '', width, height }: SkeletonProps) {
  const style: React.CSSProperties = {}
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  const variantClass = {
    text: 'h-3 w-full',
    row: 'h-10 w-full',
    card: 'h-24 w-full rounded-xl',
    circle: 'rounded-full',
  }[variant]

  return <div className={`${baseClass} ${variantClass} ${className}`} style={style} />
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 sm:px-4 py-3">
          <Skeleton className={i === cols - 1 ? 'ml-auto' : ''} width={i === 0 ? 60 : i === cols - 1 ? 80 : '70%'} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonStandingRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
      <Skeleton variant="circle" width={20} height={20} />
      <div className="flex-1 space-y-1.5">
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={10} />
      </div>
      <Skeleton width={50} height={12} />
    </div>
  )
}
