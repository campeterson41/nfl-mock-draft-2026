import styles from './PickCard.module.css'
import { POSITION_COLORS } from '../../../constants/positions'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function darkenColor(hex, amount = 60) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function PickCard({ pick, player, team, isUserPick, onDismiss }) {
  const posColor = POSITION_COLORS[player.position] ?? '#666'
  const primaryColor = team.colors?.primary ?? '#1a1d27'
  const darkened = darkenColor(primaryColor, 50)
  const isTopTen = player.rank <= 10

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.card} ${isUserPick ? styles.userPick : ''}`}
        style={{ '--team-primary': primaryColor, '--team-dark': darkened }}
      >
        {/* Header gradient */}
        <div className={styles.header}>
          <div className={styles.pickLabel}>
            PICK #{pick.overall}
          </div>
          <div className={styles.roundLabel}>
            ROUND {pick.round} &middot; PICK {pick.roundPick} OF {pick.round === 1 ? 32 : pick.round <= 3 ? 'THE ROUND' : 'THE ROUND'}
          </div>
          <div
            className={styles.teamName}
            style={{ color: team.colors?.secondary && team.colors.secondary !== '#FFFFFF' ? team.colors.secondary : '#ffffff' }}
          >
            {team.fullName.toUpperCase()}
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <p className={styles.broadcastLine}>
            WITH THE {ordinal(pick.overall).toUpperCase()} PICK, THE {team.nickname.toUpperCase()} SELECT&hellip;
          </p>

          <h1 className={styles.playerName}>{player.name}</h1>

          <div className={styles.badges}>
            <span className={styles.positionBadge} style={{ background: posColor }}>
              {player.position}
            </span>
            <span className={styles.school}>{player.school}</span>
          </div>

          {isTopTen && (
            <div className={styles.topTenBanner}>
              Top 10 Pick &mdash; Ranked #{player.rank} Overall
            </div>
          )}

          {isUserPick && (
            <div className={styles.userPickBadge}>YOUR PICK</div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.continueBtn} onClick={onDismiss}>
            CONTINUE &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
