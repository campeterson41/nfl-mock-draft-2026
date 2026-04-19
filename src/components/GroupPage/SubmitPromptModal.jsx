import { useState } from 'react'
import { submitPrediction } from '../../lib/groupApi.js'
import styles from './CreateGroupModal.module.css'

/**
 * Confirms submission of the current picks + trades to a group.
 * Used when the user joined via a /group/:id URL.
 *
 * `selectedPlayers`: the DraftProvider's selectedPlayers state (overall -> { player, teamId })
 * `tradeHistory`: the DraftProvider's tradeHistory array
 */
export default function SubmitPromptModal({
  isOpen,
  group,           // { id, name, teamId, ... }
  memberName,      // pre-filled from URL/context
  selectedPlayers,
  tradeHistory,
  onClose,
  onSubmitted,     // () -> navigate to /group/:id
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen || !group) return null

  const pickEntries = Object.entries(selectedPlayers ?? {})
  const pickCount = pickEntries.length

  // Convert selectedPlayers into the simpler submission shape:
  //   { [overall]: playerId }
  const picksPayload = {}
  for (const [overall, sp] of pickEntries) {
    if (sp?.player?.id) picksPayload[overall] = sp.player.id
  }

  // Convert tradeHistory (only those where userTeamId matches the group team)
  const tradesPayload = (tradeHistory ?? [])
    .filter(t => t.userTeamId === group.teamId)
    .map(t => ({
      partnerId: t.targetTeamId,
      gave: {
        pickOveralls: t.gave?.pickOveralls ?? [],
        futurePickIds: t.gave?.futurePickIds ?? [],
      },
      received: {
        pickOveralls: t.received?.pickOveralls ?? [],
        futurePickIds: t.received?.futurePickIds ?? [],
      },
    }))

  async function handleSubmit() {
    if (submitting || !memberName) return
    setError(null)
    setSubmitting(true)
    try {
      await submitPrediction(group.id, {
        name: memberName,
        picks: picksPayload,
        trades: tradesPayload,
      })
      onSubmitted?.()
    } catch (err) {
      setError(err?.message ?? 'Submission failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>SUBMIT TO GROUP</h2>
          <button className={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        <p className={styles.intro}>
          Submit your predictions to <strong>{group.name}</strong> as <strong>{memberName}</strong>.
        </p>

        <div className={styles.groupMeta}>
          <p><strong>Picks:</strong> {pickCount}</p>
          <p><strong>Trades:</strong> {tradesPayload.length}</p>
        </div>

        <p className={styles.intro}>
          You can come back and update your predictions any time before the real draft starts — submitting again replaces your previous entry.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={onClose}>CANCEL</button>
          <button
            className={styles.primaryBtn}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'SUBMITTING...' : 'SUBMIT'}
          </button>
        </div>
      </div>
    </div>
  )
}
