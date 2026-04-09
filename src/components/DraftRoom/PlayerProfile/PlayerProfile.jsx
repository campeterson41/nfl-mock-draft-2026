import { useMemo } from 'react'
import styles from './PlayerProfile.module.css'
import { POSITION_COLORS } from '../../../constants/positions'
import beastProfiles from '../../../data/beastProfiles.json'

// Build lookup once
const profileMap = {}
beastProfiles.forEach(p => { if (p.playerId) profileMap[p.playerId] = p })

function MeasurablesBar({ label, value, min, max, unit = '' }) {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) return null
  const pct = Math.min(100, Math.max(5, ((num - min) / (max - min)) * 100))
  return (
    <div className={styles.measRow}>
      <span className={styles.measLabel}>{label}</span>
      <div className={styles.measTrack}>
        <div className={styles.measFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.measValue}>{value}{unit}</span>
    </div>
  )
}

export default function PlayerProfile({ player, isOpen, onClose, onDraft, canDraft }) {
  if (!isOpen || !player) return null

  const profile = profileMap[player.id]
  const posColor = POSITION_COLORS[player.position] ?? '#4a4d66'

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header} style={{ '--pos-color': posColor }}>
          <div className={styles.headerTop}>
            <span className={styles.posRank}>{profile?.posRank ?? player.position}</span>
            <button className={styles.closeBtn} onClick={onClose}>X</button>
          </div>
          <h2 className={styles.playerName}>{player.name}</h2>
          <div className={styles.headerMeta}>
            <span className={styles.posBadge} style={{ background: posColor }}>{player.position}</span>
            <span className={styles.school}>{player.school}</span>
            {profile?.grade && <span className={styles.grade}>{profile.grade}</span>}
          </div>
          <div className={styles.headerStats}>
            {(profile?.height || player.height) && <span className={styles.stat}>{profile?.height || player.height}</span>}
            {(profile?.weight || player.weight) && <span className={styles.stat}>{profile?.weight || player.weight} lbs</span>}
            {profile?.age && <span className={styles.stat}>Age {profile.age}</span>}
            {profile?.forty && <span className={styles.stat}>{profile.forty}s 40-yd</span>}
          </div>
          {canDraft && (
            <button className={styles.draftBtn} onClick={() => { onDraft(player); onClose(); }}>
              DRAFT {player.name.split(' ').pop().toUpperCase()}
            </button>
          )}
        </div>

        <div className={styles.body}>
          {/* Consensus rank */}
          <div className={styles.rankStrip}>
            <div className={styles.rankItem}>
              <span className={styles.rankNum}>#{player.rank}</span>
              <span className={styles.rankLabel}>CONSENSUS</span>
            </div>
            {player.mockRange && (
              <>
                <div className={styles.rankItem}>
                  <span className={styles.rankNum}>#{player.mockRange.floor}</span>
                  <span className={styles.rankLabel}>HIGHEST</span>
                </div>
                <div className={styles.rankItem}>
                  <span className={styles.rankNum}>#{player.mockRange.ceiling}</span>
                  <span className={styles.rankLabel}>LOWEST</span>
                </div>
              </>
            )}
          </div>

          {/* Strengths & Weaknesses side by side */}
          {profile && (profile.strengths?.length > 0 || profile.weaknesses?.length > 0) && (
            <div className={styles.prosConsGrid}>
              {profile.strengths?.length > 0 && (
                <div className={styles.prosCol}>
                  <h3 className={styles.prosTitle}>STRENGTHS</h3>
                  <ul className={styles.prosList}>
                    {profile.strengths.map((s, i) => (
                      <li key={i} className={styles.prosItem}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {profile.weaknesses?.length > 0 && (
                <div className={styles.consCol}>
                  <h3 className={styles.consTitle}>WEAKNESSES</h3>
                  <ul className={styles.consList}>
                    {profile.weaknesses.map((w, i) => (
                      <li key={i} className={styles.consItem}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Scout Summary */}
          {profile?.summary && (
            <div className={styles.summarySection}>
              <h3 className={styles.sectionTitle}>SCOUTING REPORT</h3>
              <p className={styles.summaryText}>{profile.summary}</p>
              <p className={styles.attribution}>Source: The Athletic "The Beast"</p>
            </div>
          )}

          {/* No Beast profile fallback */}
          {!profile && (
            <div className={styles.noProfile}>
              <p>No detailed scouting report available for this prospect.</p>
              {player.notes && <p className={styles.fallbackNotes}>{player.notes}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
