import clsx from 'clsx'

export default function Badge({ count, max = 99, className }) {
  if (!count || count === 0) return null
  const display = count > max ? `${max}+` : count
  return (
    <span
      className={clsx(
        'badge animate-scale-in',
        className
      )}
    >
      {display}
    </span>
  )
}
