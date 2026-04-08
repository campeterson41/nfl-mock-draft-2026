import styles from './PickTimer.module.css'

/**
 * SVG circle countdown clock.
 * Props: { timeLeft: number, duration: number, isActive: boolean }
 */
export default function PickTimer({ timeLeft, duration = 30, isActive }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius // ≈ 226.2
  const progress = timeLeft / duration
  const dashOffset = circumference * (1 - progress)

  const isUrgent = timeLeft <= 4
  const isWarning = timeLeft <= 9 && !isUrgent

  const strokeColor = isUrgent
    ? 'var(--accent-red)'
    : isWarning
    ? 'var(--accent-gold)'
    : 'rgba(255,255,255,0.85)'

  const textColor = isUrgent
    ? 'var(--accent-red)'
    : isWarning
    ? 'var(--accent-gold)'
    : 'var(--text-primary)'

  return (
    <div
      className={`${styles.wrapper} ${isActive ? styles.active : ''} ${isUrgent ? styles.urgent : ''}`}
    >
      <svg
        className={styles.svg}
        width="88"
        height="88"
        viewBox="0 0 88 88"
        aria-label={`${timeLeft} seconds remaining`}
      >
        {/* Track ring */}
        <circle
          className={styles.track}
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="5"
        />
        {/* Progress ring */}
        <circle
          className={styles.progress}
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="5"
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '44px 44px',
            transition: isActive ? 'stroke-dashoffset 1s linear, stroke 300ms ease' : 'none',
          }}
        />
        {/* Time label */}
        <text
          className={styles.label}
          x="44"
          y="44"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fill: textColor, transition: 'fill 300ms ease' }}
        >
          {timeLeft}
        </text>
        {/* "SEC" sub-label */}
        <text
          className={styles.sublabel}
          x="44"
          y="58"
          textAnchor="middle"
          dominantBaseline="central"
        >
          SEC
        </text>
      </svg>

      {/* Pulsing glow when urgent */}
      {isUrgent && isActive && <div className={styles.urgentGlow} />}
    </div>
  )
}
