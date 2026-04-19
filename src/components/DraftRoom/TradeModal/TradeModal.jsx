import { useState, useMemo } from 'react'
import { getPickValue, getFuturePickValue } from '../../../engine/tradeEngine.js'
import styles from './TradeModal.module.css'

// Helper: format pick label
function pickLabel(pick) {
  return `Rd ${pick.round}, #${pick.overall} (Pick ${pick.roundPick})`
}

function futureLabel(fp) {
  const rnd = fp.round === 1 ? '1st' : '2nd'
  return `${fp.year} ${rnd} Rd (${fp.projectedRange ?? 'mid'})`
}

export default function TradeModal({
  isOpen, direction, targetPick, targetTeam,
  userTeamId, userTeam, userCurrentPicks, userFuturePicks,
  allFuturePicks, allPicks, allTeams, currentPickOverall, sessionMode, onConfirmTrade, onClose
}) {
  // Partner team selection — pre-seeded from targetTeam if available
  const [partnerId, setPartnerId] = useState(targetTeam?.id ?? '')

  // What user is GIVING (their picks)
  const [givingPickOveralls, setGivingPickOveralls] = useState([])
  const [givingFutureIds, setGivingFutureIds] = useState([])

  // What user is RECEIVING (partner's picks)
  const [receivingPickOveralls, setReceivingPickOveralls] = useState(
    targetPick && direction === 'UP' ? [targetPick.overall] : []
  )
  const [receivingFutureIds, setReceivingFutureIds] = useState([])

  // Predictive-mode force-trade override
  const [forceTrade, setForceTrade] = useState(false)
  const isPredictive = sessionMode === 'predictive'

  if (!isOpen) return null

  const partner = partnerId ? allTeams[partnerId] : null

  // All 32 teams except user's team for the partner selector
  const partnerOptions = Object.values(allTeams)
    .filter(t => t.id !== userTeamId)
    .sort((a, b) => a.nickname.localeCompare(b.nickname))

  // Partner's remaining picks (only future picks that haven't been made yet)
  const partnerCurrentPicks = useMemo(() =>
    (allPicks ?? []).filter(p => p.teamId === partnerId && p.overall >= currentPickOverall),
    [allPicks, partnerId, currentPickOverall]
  )

  // Partner's future picks
  const partnerFuturePicks = useMemo(() =>
    (allFuturePicks ?? []).filter(fp => fp.ownerTeamId === partnerId),
    [allFuturePicks, partnerId]
  )

  // Value calculations
  const givingValue = useMemo(() => {
    const current = (userCurrentPicks ?? [])
      .filter(p => givingPickOveralls.includes(p.overall))
      .reduce((s, p) => s + getPickValue(p.overall), 0)
    const future = (userFuturePicks ?? [])
      .filter(fp => givingFutureIds.includes(fp.id))
      .reduce((s, fp) => s + getFuturePickValue(fp), 0)
    return current + future
  }, [givingPickOveralls, givingFutureIds, userCurrentPicks, userFuturePicks])

  const receivingValue = useMemo(() => {
    const current = partnerCurrentPicks
      .filter(p => receivingPickOveralls.includes(p.overall))
      .reduce((s, p) => s + getPickValue(p.overall), 0)
    const future = partnerFuturePicks
      .filter(fp => receivingFutureIds.includes(fp.id))
      .reduce((s, fp) => s + getFuturePickValue(fp), 0)
    return current + future
  }, [receivingPickOveralls, receivingFutureIds, partnerCurrentPicks, partnerFuturePicks])

  // Verdict
  const ratio = receivingValue > 0 ? givingValue / receivingValue : 0
  const canPropose = partnerId && (givingPickOveralls.length + givingFutureIds.length > 0 || receivingPickOveralls.length + receivingFutureIds.length > 0)
  let verdict = 'DECLINE'
  let verdictColor = '#ef4444'
  if (ratio >= 1.15) { verdict = 'OVERPAY'; verdictColor = '#d4a843' }
  else if (ratio >= 0.85) { verdict = 'ACCEPT'; verdictColor = '#22c55e' }
  else if (ratio >= 0.65) { verdict = 'COUNTER'; verdictColor = '#f59e0b' }

  // In predictive mode, require a force override when the AI would decline.
  // "Would decline" = verdict is DECLINE or COUNTER (both are rejection outcomes).
  const aiWouldAccept = verdict === 'ACCEPT' || verdict === 'OVERPAY'
  const predictiveGate = isPredictive && canPropose && !aiWouldAccept && !forceTrade
  const submitEnabled = canPropose && partnerId && !predictiveGate

  function toggleGiving(overall) {
    setGivingPickOveralls(prev =>
      prev.includes(overall) ? prev.filter(x => x !== overall) : [...prev, overall]
    )
  }
  function toggleGivingFuture(id) {
    setGivingFutureIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }
  function toggleReceiving(overall) {
    setReceivingPickOveralls(prev =>
      prev.includes(overall) ? prev.filter(x => x !== overall) : [...prev, overall]
    )
  }
  function toggleReceivingFuture(id) {
    setReceivingFutureIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handlePropose() {
    if (!submitEnabled) return
    onConfirmTrade({
      userTeamId,
      targetTeamId: partnerId,
      userGiving: { pickOveralls: givingPickOveralls, futurePickIds: givingFutureIds },
      userReceiving: { pickOveralls: receivingPickOveralls, futurePickIds: receivingFutureIds },
      targetPickOverall: receivingPickOveralls[0] ?? null,
    })
  }

  // Reset partner picks when partner changes
  function handlePartnerChange(newId) {
    setPartnerId(newId)
    setReceivingPickOveralls([])
    setReceivingFutureIds([])
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>TRADE BUILDER</h2>
          <button className={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        {/* Partner selector */}
        <div className={styles.partnerRow}>
          <span className={styles.partnerLabel}>TRADE WITH</span>
          <select
            className={styles.partnerSelect}
            value={partnerId}
            onChange={e => handlePartnerChange(e.target.value)}
          >
            <option value="">Select a team...</option>
            {partnerOptions.map(t => (
              <option key={t.id} value={t.id}>
                {t.city} {t.nickname} ({t.abbreviation})
              </option>
            ))}
          </select>
        </div>

        {/* Value meter */}
        <div className={styles.meterRow}>
          <div className={styles.meterSide}>
            <span className={styles.meterLabel}>{userTeam?.abbreviation ?? 'YOU'} GIVE</span>
            <span className={styles.meterValue}>{givingValue.toLocaleString()} pts</span>
          </div>
          <div className={styles.meterBar}>
            <div
              className={styles.meterFill}
              style={{
                width: `${Math.min(100, givingValue / Math.max(givingValue + receivingValue, 1) * 100)}%`,
                background: verdictColor,
              }}
            />
          </div>
          <div className={styles.meterSide} style={{ textAlign: 'right' }}>
            <span className={styles.meterLabel}>YOU GET</span>
            <span className={styles.meterValue}>{receivingValue.toLocaleString()} pts</span>
          </div>
        </div>

        {/* Verdict */}
        <div className={styles.verdictRow}>
          <span className={styles.verdictBadge} style={{ color: verdictColor, borderColor: verdictColor }}>
            {verdict}
          </span>
          <span className={styles.verdictNote}>
            {ratio > 0 ? `${((ratio - 1) * 100).toFixed(0)}% ${ratio >= 1 ? 'surplus' : 'deficit'}` : 'Select picks to evaluate'}
          </span>
        </div>

        {/* Two-column pick selector */}
        <div className={styles.columns}>
          {/* LEFT: User's picks to give */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>
                {userTeam?.abbreviation ?? 'YOUR'} PICKS — SELECT TO GIVE
              </span>
            </div>
            <div className={styles.pickList}>
              <div className={styles.pickGroup}>
                <div className={styles.pickGroupLabel}>2026 DRAFT</div>
                {(userCurrentPicks ?? []).length === 0 && (
                  <div className={styles.emptyPicks}>No remaining picks</div>
                )}
                {(userCurrentPicks ?? []).map(pick => {
                  const val = getPickValue(pick.overall)
                  const checked = givingPickOveralls.includes(pick.overall)
                  return (
                    <label key={pick.overall} className={`${styles.pickRow} ${checked ? styles.pickRowChecked : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGiving(pick.overall)}
                        className={styles.checkbox}
                      />
                      <span className={styles.pickName}>{pickLabel(pick)}</span>
                      <span className={styles.pickPts}>{val.toLocaleString()}</span>
                    </label>
                  )
                })}
              </div>
              <div className={styles.pickGroup}>
                <div className={styles.pickGroupLabel}>2027 PICKS</div>
                {(userFuturePicks ?? []).length === 0 && (
                  <div className={styles.emptyPicks}>No future picks</div>
                )}
                {(userFuturePicks ?? []).map(fp => {
                  const val = getFuturePickValue(fp)
                  const checked = givingFutureIds.includes(fp.id)
                  return (
                    <label key={fp.id} className={`${styles.pickRow} ${checked ? styles.pickRowChecked : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGivingFuture(fp.id)}
                        className={styles.checkbox}
                      />
                      <span className={styles.pickName}>{futureLabel(fp)}</span>
                      <span className={styles.pickPts}>{val.toLocaleString()}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Partner's picks to receive */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>
                {partner ? `${partner.abbreviation} PICKS — SELECT TO GET` : 'SELECT A PARTNER TEAM'}
              </span>
            </div>
            {!partner ? (
              <div className={styles.noPartner}>Choose a team to see their picks</div>
            ) : (
              <div className={styles.pickList}>
                <div className={styles.pickGroup}>
                  <div className={styles.pickGroupLabel}>2026 DRAFT</div>
                  {partnerCurrentPicks.length === 0 && (
                    <div className={styles.emptyPicks}>No remaining picks</div>
                  )}
                  {partnerCurrentPicks.map(pick => {
                    const val = getPickValue(pick.overall)
                    const checked = receivingPickOveralls.includes(pick.overall)
                    return (
                      <label key={pick.overall} className={`${styles.pickRow} ${checked ? styles.pickRowChecked : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReceiving(pick.overall)}
                          className={styles.checkbox}
                        />
                        <span className={styles.pickName}>{pickLabel(pick)}</span>
                        <span className={styles.pickPts}>{val.toLocaleString()}</span>
                      </label>
                    )
                  })}
                </div>
                <div className={styles.pickGroup}>
                  <div className={styles.pickGroupLabel}>2027 PICKS</div>
                  {partnerFuturePicks.length === 0 && (
                    <div className={styles.emptyPicks}>No future picks</div>
                  )}
                  {partnerFuturePicks.map(fp => {
                    const val = getFuturePickValue(fp)
                    const checked = receivingFutureIds.includes(fp.id)
                    return (
                      <label key={fp.id} className={`${styles.pickRow} ${checked ? styles.pickRowChecked : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReceivingFuture(fp.id)}
                          className={styles.checkbox}
                        />
                        <span className={styles.pickName}>{futureLabel(fp)}</span>
                        <span className={styles.pickPts}>{val.toLocaleString()}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {isPredictive && canPropose && !aiWouldAccept && (
          <div className={styles.forceRow} style={{
            padding: '10px 16px',
            borderTop: '1px solid #1a1d27',
            background: 'rgba(239, 68, 68, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#fafafa',
              fontWeight: 600,
            }}>
              <input
                type="checkbox"
                checked={forceTrade}
                onChange={(e) => setForceTrade(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Force this trade (override AI response)
            </label>
            <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa', lineHeight: 1.4, paddingLeft: 24 }}>
              {forceTrade
                ? "You're forcing a trade the AI would decline. This is unrealistic but sometimes wild trades happen."
                : "This trade would be declined — check the box to push it through anyway for prediction purposes."}
            </p>
          </div>
        )}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.proposeBtn}
            onClick={handlePropose}
            disabled={!submitEnabled}
            style={{ opacity: submitEnabled ? 1 : 0.4 }}
          >
            {isPredictive && canPropose && !aiWouldAccept
              ? (forceTrade ? 'FORCE TRADE (AI DECLINES)' : 'PROPOSE TRADE')
              : 'PROPOSE TRADE'}
          </button>
        </div>
      </div>
    </div>
  )
}
