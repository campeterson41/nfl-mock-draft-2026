import styles from './AppNav.module.css'

export default function AppNav({ onHome, onOpenScraper, sessionIntelCount = 0 }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <button className={styles.homeBtn} onClick={onHome} title="Back to setup">
          <span className={styles.homeLogo}>
            <span className={styles.homeYear}>2026</span>
            <span className={styles.homeNfl}>NFL</span>
          </span>
          <span className={styles.homeLabel}>MOCK DRAFT</span>
        </button>
      </div>

      <div className={styles.right}>
        <button
          className={styles.navBtn}
          onClick={onOpenScraper}
          title="Paste a URL or article to extract draft intel"
        >
          SOURCES{sessionIntelCount > 0 ? ` (${sessionIntelCount})` : ''}
        </button>

        <button
          className={`${styles.navBtn} ${styles.navBtnHome}`}
          onClick={onHome}
          title="Return to setup"
        >
          ← HOME
        </button>
      </div>
    </nav>
  )
}
