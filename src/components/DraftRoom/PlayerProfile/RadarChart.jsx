import styles from './RadarChart.module.css'

const LABELS = {
  speed: 'SPEED',
  explosion: 'EXPLOSION',
  power: 'POWER',
  agility: 'AGILITY',
  size: 'SIZE',
  quickness: 'QUICKNESS',
}

export default function RadarChart({ percentiles }) {
  if (!percentiles) return null

  // Get available dimensions (need at least 3)
  const dims = Object.entries(percentiles).filter(([, v]) => v != null)
  if (dims.length < 3) return null

  const cx = 100, cy = 100, r = 75
  const n = dims.length
  const angleStep = (2 * Math.PI) / n

  // Generate polygon points for the data shape
  const dataPoints = dims.map(([, value], i) => {
    const angle = angleStep * i - Math.PI / 2
    const dist = (value / 100) * r
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)]
  })

  // Generate grid rings at 25%, 50%, 75%, 100%
  const rings = [25, 50, 75, 100].map(pct => {
    const ringR = (pct / 100) * r
    const pts = dims.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return `${cx + ringR * Math.cos(angle)},${cy + ringR * Math.sin(angle)}`
    })
    return pts.join(' ')
  })

  // Axis lines
  const axisLines = dims.map((_, i) => {
    const angle = angleStep * i - Math.PI / 2
    return {
      x2: cx + r * Math.cos(angle),
      y2: cy + r * Math.sin(angle),
    }
  })

  // Label positions
  const labelPositions = dims.map(([key], i) => {
    const angle = angleStep * i - Math.PI / 2
    const labelR = r + 18
    return {
      x: cx + labelR * Math.cos(angle),
      y: cy + labelR * Math.sin(angle),
      label: LABELS[key] || key.toUpperCase(),
      value: dims[i][1],
    }
  })

  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + 'Z'

  return (
    <div className={styles.container}>
      <svg viewBox="0 0 200 200" className={styles.svg}>
        {/* Grid rings */}
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={line.x2} y2={line.y2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        ))}

        {/* Data shape */}
        <path
          d={dataPath}
          fill="rgba(212, 168, 67, 0.15)"
          stroke="#d4a843"
          strokeWidth="1.5"
        />

        {/* Data points */}
        {dataPoints.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#d4a843" />
        ))}

        {/* Labels */}
        {labelPositions.map((lp, i) => (
          <text
            key={i}
            x={lp.x} y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.label}
          >
            {lp.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
