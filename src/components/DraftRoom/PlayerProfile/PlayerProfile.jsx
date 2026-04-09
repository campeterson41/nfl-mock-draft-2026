import { useState, useMemo } from 'react'
import styles from './PlayerProfile.module.css'
import { POSITION_COLORS } from '../../../constants/positions'
import RadarChart from './RadarChart.jsx'
import beastProfiles from '../../../data/beastProfiles.json'

const profileMap = {}
beastProfiles.forEach(p => { if (p.playerId) profileMap[p.playerId] = p })

// Smooth color interpolation: red (0%) -> yellow (50%) -> green (100%)
// Uses muted tones to stay subtle
function tierColor(pct, forText = false) {
  // Clamp 0-100
  const t = Math.max(0, Math.min(100, pct))
  if (t <= 50) {
    // Red to yellow (0-50)
    const ratio = t / 50
    const r = forText ? Math.round(158 + ratio * (154 - 158)) : Math.round(138 + ratio * (138 - 138))
    const g = forText ? Math.round(114 + ratio * (144 - 114)) : Math.round(90 + ratio * (125 - 90))
    const b = forText ? Math.round(114 + ratio * (112 - 114)) : Math.round(90 + ratio * (85 - 90))
    return `rgb(${r},${g},${b})`
  } else {
    // Yellow to green (50-100)
    const ratio = (t - 50) / 50
    const r = forText ? Math.round(154 - ratio * (154 - 122)) : Math.round(138 - ratio * (138 - 90))
    const g = forText ? Math.round(144 + ratio * (158 - 144)) : Math.round(125 + ratio * (138 - 125))
    const b = forText ? Math.round(112 - ratio * (112 - 112)) : Math.round(85 - ratio * (85 - 85))
    return `rgb(${r},${g},${b})`
  }
}

function MeasurableBar({ label, value, rank, total, pos }) {
  const [showTip, setShowTip] = useState(false)
  if (rank == null || total == null) return null
  const pct = Math.max(1, Math.round(((total - rank + 1) / total) * 100))
  const color = tierColor(pct)
  const valueColor = tierColor(pct, true)
  return (
    <div
      className={styles.pctRow}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => setShowTip(prev => !prev)}
    >
      <span className={styles.pctLabel}>{label}</span>
      <div className={styles.pctTrack}>
        <div className={styles.pctFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.pctValue} style={{ color: valueColor }}>{value}</span>
      {showTip && (
        <span className={styles.tooltip}>#{rank}/{total} {pos}s</span>
      )}
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

function StatPill({ children, tierStyle, tip }) {
  const [showTip, setShowTip] = useState(false)
  return (
    <span
      className={styles.stat}
      style={tierStyle || {}}
      onMouseEnter={() => tip && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => tip && setShowTip(prev => !prev)}
    >
      {children}
      {showTip && tip && <span className={styles.tooltip}>{tip}</span>}
    </span>
  )
}

export default function PlayerProfile({ player, isOpen, onClose, onDraft, canDraft, playerDrafted }) {
  if (!isOpen || !player) return null

  const profile = profileMap[player.id]
  const posColor = POSITION_COLORS[player.position] ?? '#4a4d66'
  const meas = profile?.measurables ?? {}
  const ranks = profile?.ranks ?? {}
  const callouts = profile?.callouts ?? []

  function statTierStyle(rankData) {
    if (!rankData) return {}
    const pct = Math.round(((rankData.total - rankData.rank + 1) / rankData.total) * 100)
    return {
      color: tierColor(pct, true),
      borderColor: tierColor(pct) + '33', // ~20% opacity
    }
  }

  function statTip(rankData) {
    if (!rankData) return null
    return `#${rankData.rank}/${rankData.total} ${player.position}s`
  }

  // Count how many players in same position group (for context)
  const posGroupCount = useMemo(() => {
    const pos = profile?.pos
    if (!pos) return 0
    return beastProfiles.filter(p => {
      let ppos = p.pos
      if (ppos === 'OG' || ppos === 'OC') ppos = 'IOL'
      if (ppos === 'SAF') ppos = 'S'
      let myPos = pos
      if (myPos === 'OG' || myPos === 'OC') myPos = 'IOL'
      if (myPos === 'SAF') myPos = 'S'
      return ppos === myPos && p.measurables && Object.keys(p.measurables).length > 0
    }).length
  }, [profile])

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
            {profile?.grade && <span className={styles.grade}>PROJ: {profile.grade.toLowerCase().includes('round') ? profile.grade : profile.grade + ' round'}</span>}
          </div>
          <div className={styles.headerStats}>
            {(profile?.height || meas.height) && <StatPill tierStyle={statTierStyle(ranks.height)} tip={statTip(ranks.height)}>{profile?.height || meas.height}</StatPill>}
            {(profile?.weight || meas.weight) && <StatPill tierStyle={statTierStyle(ranks.size)} tip={statTip(ranks.size)}>{meas.weight || profile?.weight} lbs</StatPill>}
            {profile?.age && <StatPill tierStyle={statTierStyle(ranks.age)} tip={statTip(ranks.age)}>Age {profile.age}</StatPill>}
            {meas.forty && <StatPill tierStyle={statTierStyle(ranks.speed)} tip={statTip(ranks.speed)}>{meas.forty}s 40-yd</StatPill>}
            {meas.vertJump && <StatPill tierStyle={statTierStyle(ranks.explosion)} tip={statTip(ranks.explosion)}>{meas.vertJump}" vert</StatPill>}
          </div>
          {canDraft && (
            <button className={styles.draftBtn} onClick={() => { onDraft(player); onClose(); }}>
              DRAFT {player.name.split(' ').pop().toUpperCase()}
            </button>
          )}
          {playerDrafted && (
            <button className={styles.draftBtnDisabled} disabled>
              ALREADY DRAFTED
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

          {/* Radar chart + rank bars side by side */}
          {Object.keys(ranks).length >= 3 && (
            <div className={styles.measSection}>
              <h3 className={styles.sectionTitle}>ATHLETIC PROFILE</h3>
              <p className={styles.sectionContext}>
                Ranked against {posGroupCount} {player.position}s in the 2026 draft class
              </p>
              <div className={styles.measGrid}>
                <RadarChart percentiles={Object.fromEntries(
                  Object.entries(ranks)
                    .filter(([k]) => k in { height:1, size:1, speed:1, explosion:1, power:1, agility:1, quickness:1 })
                    .map(([k, v]) => [k, Math.max(1, Math.round(((v.total - v.rank + 1) / v.total) * 100))])
                )} />
                <div className={styles.pctBars}>
                  {ranks.height && <MeasurableBar label="Height" value={meas.height || '—'} rank={ranks.height.rank} total={ranks.height.total} pos={player.position} />}
                  {ranks.size && <MeasurableBar label="Weight" value={meas.weight ? `${meas.weight} lbs` : '—'} rank={ranks.size.rank} total={ranks.size.total} pos={player.position} />}
                  {ranks.speed && <MeasurableBar label="40-Yard" value={meas.forty ? `${meas.forty}s` : '—'} rank={ranks.speed.rank} total={ranks.speed.total} pos={player.position} />}
                  {ranks.explosion && <MeasurableBar label="Vert Jump" value={meas.vertJump ? `${meas.vertJump}"` : '—'} rank={ranks.explosion.rank} total={ranks.explosion.total} pos={player.position} />}
                  {ranks.power && <MeasurableBar label="Broad Jump" value={meas.broadJump || '—'} rank={ranks.power.rank} total={ranks.power.total} pos={player.position} />}
                  {ranks.agility && <MeasurableBar label="3-Cone" value={meas.threeCone ? `${meas.threeCone}s` : '—'} rank={ranks.agility.rank} total={ranks.agility.total} pos={player.position} />}
                  {ranks.quickness && <MeasurableBar label="Shuttle" value={meas.shuttle ? `${meas.shuttle}s` : '—'} rank={ranks.quickness.rank} total={ranks.quickness.total} pos={player.position} />}
                </div>
              </div>
            </div>
          )}

          {/* Measurables fallback (when < 3 ranks, show raw numbers) */}
          {Object.keys(ranks).length < 3 && Object.keys(meas).length > 0 && (
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
