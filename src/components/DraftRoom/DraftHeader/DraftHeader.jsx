import styles from './DraftHeader.module.css'

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
            <span className={styles.ctaIcon}>{'\u21C4'}</span>
            <span className={styles.ctaLabel}>TRADE</span>
          </button>
        )}

        <button
          className={`${styles.ctaBtn} ${isPaused ? styles.ctaBtnResume : styles.ctaBtnPause}`}
          onClick={onTogglePause}
          title={isPaused ? 'Resume the draft' : 'Pause the draft'}
        >
          <span className={styles.ctaIcon}>{isPaused ? '\u25B6' : '\u23F8'}</span>
          <span className={styles.ctaLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</span>
        </button>

        {!isObserver && hasUpcomingUserPick && (
          <button
            className={`${styles.ctaBtn} ${isSkipping ? styles.ctaBtnSimActive : styles.ctaBtnSkip}`}
            onClick={onSkipToMyPick}
            disabled={isSkipping}
            title="Fast-forward to your next pick"
          >
            <span className={styles.ctaIcon}>{'\u23ED'}</span>
            <span className={styles.ctaLabel}>{isSkipping ? 'SKIPPING...' : 'SKIP TO MY PICK'}</span>
          </button>
        )}

        <button
          className={`${styles.ctaBtn} ${styles.ctaBtnSim} ${fastSim ? styles.ctaBtnSimActive : ''}`}
          onClick={onToggleFastSim}
          title={fastSim ? 'Fast sim ON' : 'Enable fast sim'}
        >
          <span className={styles.ctaIcon}>{'\u26A1'}</span>
          <span className={styles.ctaLabel}>FAST SIM</span>
          <span className={`${styles.simDot} ${fastSim ? styles.simDotActive : ''}`} />
        </button>
      </div>
    </header>
  )
}
