import { Link } from 'react-router-dom'
import styles from './SiteFooter.module.css'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <span className={styles.text}>2026 NFL Mock Draft Simulator</span>
      <span className={styles.dot} />
      <Link to="/about" className={styles.link}>About</Link>
      <span className={styles.dot} />
      <Link to="/privacy" className={styles.link}>Privacy Policy</Link>
    </footer>
  )
}
