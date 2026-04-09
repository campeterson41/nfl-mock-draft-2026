import { useMemo } from 'react'
import styles from './PlayerProfile.module.css'
import { POSITION_COLORS } from '../../../constants/positions'
import RadarChart from './RadarChart.jsx'
import beastProfiles from '../../../data/beastProfiles.json'

const profileMap = {}
beastProfiles.forEach(p => { if (p.playerId) profileMap[p.playerId] = p })

function PercentileBar({ label, value, pct, invert }) {
  if (pct == null) return null
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#d4a843' : pct >= 40 ? '#a1a1aa' : '#f87171'
  return (
    <div className={styles.pctRow}>
      <span className={styles.pctLabel}>{label}</span>
      <div className={styles.pctTrack}>
        <div className={styles.pctFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.pctValue}>{value}</span>
      <span className={styles.pctPct} style={{ color }}>{pct}th</span>
    </div>
  )
}

function DraftRange({ floor, consensus, ceiling }) {
  if (!floor || !ceiling) return null
  const range = ceiling - floor
  if (range <= 0) return null
  const consPct = ((consensus - floor) / range) * 100
  return (
    <div className={styles.rangeContainer}>
      <div className={styles.rangeTrack}>
        <div className={styles.rangeFill} />
        <div className={styles.rangeMarker} style={{ left: `${consPct}%` }}>
          <span className={styles.rangeMarkerLabel}>#{consensus}</span>
        </div>
      </div>
      <div className={styles.rangeLabels}>
        <span>#{floor}</span>
        <span>#{ceiling}</span>
      </div>
    </div>
  )
}

export default function PlayerProfile({ player, isOpen, onClose, onDraft, canDraft }) {
  if (!isOpen || !player) return null

  const profile = profileMap[player.id]
  const posColor = POSITION_COLORS[player.position] ?? '#4a4d66'
  const meas = profile?.measurables ?? {}
  const pcts = profile?.percentiles ?? {}
  const callouts = profile?.callouts ?? []

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
            {(profile?.height || meas.height) && <span className={styles.stat}>{profile?.height || meas.height}</span>}
            {(profile?.weight || meas.weight) && <span className={styles.stat}>{meas.weight || profile?.weight} lbs</span>}
            {profile?.age && <span className={styles.stat}>Age {profile.age}</span>}
            {meas.forty && <span className={styles.stat}>{meas.forty}s 40-yd</span>}
            {meas.vertJump && <span className={styles.stat}>{meas.vertJump}" vert</span>}
          </div>
          {canDraft && (
            <button className={styles.draftBtn} onClick={() => { onDraft(player); onClose(); }}>
              DRAFT {player.name.split(' ').pop().toUpperCase()}
            </button>
          )}
        </div>

        <div className={styles.body}>
          {/* Elite callouts */}
          {callouts.length > 0 && (
            <div className={styles.callouts}>
              {callouts.map((c, i) => (
                <div key={i} className={styles.callout}>{c}</div>
              ))}
            </div>
          )}

          {/* Draft range */}
          {player.mockRange && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>DRAFT RANGE</h3>
              <DraftRange
                floor={player.mockRange.floor}
                consensus={player.mockRange.consensus}
                ceiling={player.mockRange.ceiling}
              />
            </div>
          )}

          {/* Radar chart + percentile bars side by side */}
          {Object.keys(pcts).length >= 3 && (
            <div className={styles.measSection}>
              <h3 className={styles.sectionTitle}>ATHLETIC PROFILE</h3>
              <div className={styles.measGrid}>
                <RadarChart percentiles={pcts} />
                <div className={styles.pctBars}>
                  <PercentileBar label="Speed" value={meas.forty ? `${meas.forty}s` : '—'} pct={pcts.speed} />
                  <PercentileBar label="Explosion" value={meas.vertJump ? `${meas.vertJump}"` : '—'} pct={pcts.explosion} />
                  <PercentileBar label="Power" value={meas.broadJump || '—'} pct={pcts.power} />
                  <PercentileBar label="Agility" value={meas.threeCone ? `${meas.threeCone}s` : '—'} pct={pcts.agility} />
                  <PercentileBar label="Quickness" value={meas.shuttle ? `${meas.shuttle}s` : '—'} pct={pcts.quickness} />
                  <PercentileBar label="Size" value={meas.weight ? `${meas.weight}` : '—'} pct={pcts.size} />
                </div>
              </div>
            </div>
          )}

          {/* Measurables fallback (when < 3 percentiles, show raw numbers) */}
          {Object.keys(pcts).length < 3 && Object.keys(meas).length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>MEASURABLES</h3>
              <div className={styles.measRaw}>
                {meas.forty && <div className={styles.measRawItem}><span className={styles.measRawLabel}>40-YD</span><span className={styles.measRawVal}>{meas.forty}s</span></div>}
                {meas.vertJump && <div className={styles.measRawItem}><span className={styles.measRawLabel}>VERT</span><span className={styles.measRawVal}>{meas.vertJump}"</span></div>}
                {meas.broadJump && <div className={styles.measRawItem}><span className={styles.measRawLabel}>BROAD</span><span className={styles.measRawVal}>{meas.broadJump}</span></div>}
                {meas.threeCone && <div className={styles.measRawItem}><span className={styles.measRawLabel}>3-CONE</span><span className={styles.measRawVal}>{meas.threeCone}s</span></div>}
                {meas.handSize && <div className={styles.measRawItem}><span className={styles.measRawLabel}>HAND</span><span className={styles.measRawVal}>{meas.handSize}"</span></div>}
                {meas.armLength && <div className={styles.measRawItem}><span className={styles.measRawLabel}>ARM</span><span className={styles.measRawVal}>{meas.armLength}"</span></div>}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
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
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>SCOUTING REPORT</h3>
              <p className={styles.summaryText}>{profile.summary}</p>
              <p className={styles.attribution}>Source: The Athletic "The Beast"</p>
            </div>
          )}

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
