import styles from './ResumeLiveModal.module.css'

/**
 * Shown after the user hits "Start Draft" in single-team mode when the
 * live NFL draft has already made picks. Offers to resume from the
 * current live position or start a fresh simulation from pick 1.
 */
export default function ResumeLiveModal({ isOpen, livePickCount, onResume, onFresh, onClose }) {
  if (!isOpen) return null
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>LIVE DRAFT IN PROGRESS</p>
            <h2 className={styles.title}>Pick up where the real draft is?</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className={styles.body}>
          The 2026 NFL Draft has already made <strong>{livePickCount}</strong> pick{livePickCount === 1 ? '' : 's'}.
          You can resume from the current live position — every selection and trade so far will be auto-filled,
          and you’ll take over for your team from there. Or start fresh and simulate the draft from pick 1.
        </p>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={onFresh}>
            START FRESH
          </button>
          <button className={styles.btnPrimary} onClick={onResume}>
            RESUME FROM LIVE
          </button>
        </div>
      </div>
    </div>
  )
}
