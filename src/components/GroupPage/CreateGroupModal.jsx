import { useState } from 'react'
import { createGroup } from '../../lib/groupApi.js'
import styles from './CreateGroupModal.module.css'

/**
 * Modal for creating a new group. Triggered from the Predictive Mock page.
 *
 * Flow:
 *  1. User enters group name + their display name
 *  2. Submit -> POST /api/groups -> we get { id, name, teamId, ... }
 *  3. Show success state with shareable URL + copy button
 *  4. "Submit my predictions" button calls onSubmitSelf(group, memberName)
 *     which the parent uses to POST the current predictions as the first
 *     submission and redirect to /group/:id
 */
export default function CreateGroupModal({
  isOpen,
  team,
  onClose,
  onSubmitSelf,                           // async (group, memberName) -> void
  submitLabel = 'SUBMIT MY PREDICTIONS',  // text for the primary success-state button
}) {
  const [groupName, setGroupName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGroup, setCreatedGroup] = useState(null)
  const [copied, setCopied] = useState(false)
  const [submittingSelf, setSubmittingSelf] = useState(false)

  if (!isOpen) return null

  const canCreate = groupName.trim().length > 0 && memberName.trim().length > 0

  async function handleCreate() {
    if (!canCreate || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const group = await createGroup({
        name: groupName.trim(),
        teamId: team?.id,
        commissionerName: memberName.trim(),
      })
      setCreatedGroup(group)
    } catch (err) {
      setError(err?.message ?? 'Could not create group. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyLink() {
    if (!createdGroup) return
    const url = `${window.location.origin}/group/${createdGroup.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function handleSubmitSelf() {
    if (!createdGroup || submittingSelf) return
    setSubmittingSelf(true)
    try {
      await onSubmitSelf?.(createdGroup, memberName.trim())
    } finally {
      setSubmittingSelf(false)
    }
  }

  const shareUrl = createdGroup ? `${window.location.origin}/group/${createdGroup.id}` : ''

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.modal}>
        {!createdGroup ? (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>CREATE A GROUP</h2>
              <button className={styles.closeBtn} onClick={onClose}>X</button>
            </div>
            <p className={styles.intro}>
              Set up a prediction group for <strong>{team?.city} {team?.nickname}</strong>.
              Friends will join via a shareable link and compete on how accurately everyone predicts the real draft.
            </p>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>GROUP NAME</span>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. Friday Night Draft Crew"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>YOUR NAME</span>
              <input
                className={styles.input}
                type="text"
                placeholder="How should others see you?"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                maxLength={40}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.footer}>
              <button className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                disabled={!canCreate || submitting}
                onClick={handleCreate}
              >
                {submitting ? 'CREATING...' : 'CREATE GROUP'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>GROUP CREATED</h2>
              <button className={styles.closeBtn} onClick={onClose}>X</button>
            </div>
            <p className={styles.intro}>
              Share this link with friends. Each person picks their own names, makes their predictions, and submits to the group.
            </p>

            <div className={styles.shareUrlRow}>
              <input
                className={styles.shareUrl}
                type="text"
                value={shareUrl}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button className={styles.copyBtn} onClick={handleCopyLink}>
                {copied ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>

            <div className={styles.groupMeta}>
              <p><strong>Group:</strong> {createdGroup.name}</p>
              <p><strong>Team:</strong> {team?.city} {team?.nickname}</p>
              <p><strong>You:</strong> {memberName}</p>
            </div>

            <div className={styles.footer}>
              <button className={styles.secondaryBtn} onClick={onClose}>CLOSE</button>
              <button
                className={styles.primaryBtn}
                disabled={submittingSelf}
                onClick={handleSubmitSelf}
              >
                {submittingSelf ? 'LOADING...' : submitLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
