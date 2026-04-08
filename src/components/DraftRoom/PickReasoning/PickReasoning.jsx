import { useState, useMemo, useEffect, useRef } from 'react'
import styles from './PickReasoning.module.css'
import { POSITION_COLORS } from '../../../constants/positions'

function ScoreBar({ label, value, maxValue, color, isLast }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0
  return (
    <div className={styles.scoreRow}>
      <div className={styles.scoreLabel}>{label}</div>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={`${styles.scoreValue} ${isLast ? styles.scoreValueFinal : ''}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}
      </div>
    </div>
  )
}

function AnalysisRow({ label, text }) {
  return (
    <div className={styles.analysisRow}>
      <div className={styles.analysisLabel}>{label}</div>
      <p className={styles.analysisText}>{text}</p>
    </div>
  )
}

export default function PickReasoning({ reasoning, player, team, isVisible }) {
  const [isOpen, setIsOpen] = useState(false)

  function handleToggle() {
    setIsOpen(prev => !prev)
  }

  const posColor = POSITION_COLORS[player?.position] ?? '#666'
  const teamPrimary = team?.colors?.primary ?? '#c9a227'

  const maxScore = useMemo(() => {
    if (!reasoning?.scoreBreakdown) return 100
    const vals = Object.values(reasoning.scoreBreakdown).filter(v => typeof v === 'number')
    return Math.max(...vals, 1)
  }, [reasoning])

  if (!reasoning) return null

  const { scoreBreakdown, topQuote, insiderAnalysis, allQuotes = [] } = reasoning

  const scoreStages = [
    { label: 'Base',         value: scoreBreakdown?.base,           color: '#3b82f6' },
    { label: 'Need',         value: scoreBreakdown?.afterNeed,      color: '#10b981' },
    { label: 'Beat Writers', value: scoreBreakdown?.afterBeatWriter, color: '#8b5cf6' },
    { label: 'Regime',       value: scoreBreakdown?.afterRegime,    color: '#f59e0b' },
    { label: 'Final',        value: scoreBreakdown?.final,          color: '#d4a843' },
  ]

  return (
    <div className={styles.panel} aria-label="Pick Reasoning">
      {/* Always-visible header — click to toggle */}
      <button
        className={styles.accordionHeader}
        onClick={handleToggle}
        style={{ '--team-primary': teamPrimary }}
        aria-expanded={isOpen}
      >
        <div className={styles.headerLeft}>
          <span className={styles.teamAbbr}>{team?.abbreviation}</span>
          <span className={styles.posBadge} style={{ background: posColor }}>
            {player?.position}
          </span>
          <span className={styles.playerNameHead}>{player?.name}</span>
        </div>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          ›
        </span>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className={styles.body}>
          <p className={styles.headline}>{reasoning.headline}</p>

          {/* Context rows — need, consensus, regime */}
          <div className={styles.analysisSection}>
            <AnalysisRow label="Need" text={reasoning.needAnalysis} />
            <AnalysisRow label="Consensus" text={reasoning.consensusAnalysis} />
            <AnalysisRow label="Regime" text={reasoning.regimeAnalysis} />
          </div>

          {/* All sources that linked this team to this player */}
          {allQuotes.length > 0 && (
            <div className={styles.sourceList}>
              <div className={styles.sourceListLabel}>SOURCES</div>
              {allQuotes.map((q, i) => (
                <div key={i} className={`${styles.sourceItem} ${q.isInsider ? styles.sourceItemInsider : ''}`}>
                  <div className={styles.sourceHeader}>
                    <span className={styles.sourceWriter}>{q.writer}</span>
                    <span className={styles.sourceOutlet}>{q.outlet}</span>
                    {q.isInsider && <span className={styles.insiderChip}>INSIDER</span>}
                  </div>
                  {q.quote && (
                    <p className={styles.sourceQuote}>&ldquo;{q.quote}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No sources found message */}
          {allQuotes.length === 0 && reasoning.beatWriterAnalysis && (
            <div className={styles.analysisSection}>
              <AnalysisRow label="Intel" text={reasoning.beatWriterAnalysis} />
            </div>
          )}

          {scoreBreakdown && (
            <div className={styles.scoreSection}>
              <div className={styles.scoreSectionLabel}>SCORING</div>
              {scoreStages.map((s, i) => (
                <ScoreBar
                  key={s.label}
                  label={s.label}
                  value={s.value ?? 0}
                  maxValue={maxScore}
                  color={s.color}
                  isLast={i === scoreStages.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
