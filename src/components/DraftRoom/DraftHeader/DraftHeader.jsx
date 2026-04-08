import styles from './DraftHeader.module.css'

// Consistent 16x16 line-art SVG icons for mobile buttons
const IconTrade = () => (
  <svg className={styles.ctaIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5h12M10 2l3 3-3 3" />
    <path d="M14 11H2M6 8l-3 3 3 3" />
  </svg>
)
const IconPause = () => (
  <svg className={styles.ctaIcon} viewBox="0 0 16 16" fill="currentColor">
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
)
const IconPlay = () => (
  <svg className={styles.ctaIcon} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2.5v11l9-5.5z" />
  </svg>
)
const IconSkip = () => (
  <svg className={styles.ctaIcon} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5v11l6-5.5z" />
    <path d="M8 2.5v11l6-5.5z" />
  </svg>
)
const IconFastSim = () => (
  <svg className={styles.ctaIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 2.5l5 5.5-5 5.5" />
    <path d="M6 2.5l5 5.5-5 5.5" />
    <line x1="14" y1="2" x2="14" y2="14" />
  </svg>
)

export default function DraftHeader({
  currentPick,
  team,
  isUserTurn,
  fastSim,
  isPaused,
  isObserver = false,
  totalPicks = 257,
  onTrade,
  onTogglePause,
  onToggleFastSim,
  onSkipToMyPick,
  isSkipping = false,
  hasUpcomingUserPick = false,
}) {
  const { overall = 1, round = 1, roundPick = 1 } = currentPick ?? {}
  const teamPrimary   = team?.colors?.primary   ?? '#c9a227'
  const teamSecondary = team?.colors?.secondary ?? '#ffffff'
  const teamName      = team?.fullName ?? team?.nickname ?? '—'

  return (
    <header
      className={styles.banner}
      style={{ '--team-primary': teamPrimary, '--team-secondary': teamSecondary }}
    >
      <div className={styles.teamStripe} />
      <div className={styles.teamTint} />

      {/* LEFT: Pick info */}
      <div className={styles.left}>
        <div className={styles.pickLabel}>
          <span className={styles.roundPick}>
            ROUND {round}&nbsp;&nbsp;·&nbsp;&nbsp;PICK {roundPick}
          </span>
        </div>
        <div className={styles.pickOverall}>
          PICK&nbsp;
          <span className={styles.pickNum}>#{overall}</span>
          &nbsp;OF&nbsp;{totalPicks}
        </div>
      </div>

      {/* CENTER: Team on clock */}
      <div className={styles.center}>
        <p className={`${styles.onTheClock} ${isUserTurn ? styles.onTheClockPulse : ''}`}>
          {isPaused ? 'DRAFT PAUSED' : 'ON THE CLOCK'}
        </p>
        <p className={styles.teamName}>{teamName}</p>
        {isUserTurn && !isPaused && (
          <p className={styles.yourTurnBadge}>YOUR PICK</p>
        )}
      </div>

      {/* RIGHT: Controls */}
      <div className={styles.right}>
        {!isObserver && (
          <button
            className={`${styles.ctaBtn} ${styles.ctaBtnTrade}`}
            onClick={onTrade}
            title={isUserTurn ? 'Trade your pick away' : 'Trade up for this pick'}
          >
            <IconTrade />
            <span className={styles.ctaLabel}>TRADE</span>
          </button>
        )}

        <button
          className={`${styles.ctaBtn} ${isPaused ? styles.ctaBtnResume : styles.ctaBtnPause}`}
          onClick={onTogglePause}
          title={isPaused ? 'Resume the draft' : 'Pause the draft'}
        >
          {isPaused ? <IconPlay /> : <IconPause />}
          <span className={styles.ctaLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</span>
        </button>

        {!isObserver && hasUpcomingUserPick && (
          <button
            className={`${styles.ctaBtn} ${isSkipping ? styles.ctaBtnSimActive : styles.ctaBtnSkip}`}
            onClick={onSkipToMyPick}
            disabled={isSkipping}
            title="Fast-forward to your next pick"
          >
            <IconSkip />
            <span className={styles.ctaLabel}>{isSkipping ? 'SKIPPING...' : 'SKIP TO MY PICK'}</span>
          </button>
        )}

        <button
          className={`${styles.ctaBtn} ${styles.ctaBtnSim} ${fastSim ? styles.ctaBtnSimActive : ''}`}
          onClick={onToggleFastSim}
          title={fastSim ? 'Fast sim ON' : 'Enable fast sim'}
        >
          <IconFastSim />
          <span className={styles.ctaLabel}>FAST SIM</span>
          <span className={`${styles.simDot} ${fastSim ? styles.simDotActive : ''}`} />
        </button>
      </div>
    </header>
  )
}
