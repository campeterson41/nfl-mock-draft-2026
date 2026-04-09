import SiteFooter from '../SiteFooter/SiteFooter.jsx'
import styles from './PrivacyPolicy.module.css'

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={onBack}>← Back to Draft</button>

        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: April 8, 2026</p>

        <section className={styles.section}>
          <h2>Overview</h2>
          <p>NFL Mock Draft Simulator is a free, browser-based tool for simulating the NFL Draft. We are committed to protecting your privacy.</p>
        </section>

        <section className={styles.section}>
          <h2>Information We Collect</h2>
          <p>This application runs entirely in your browser. We do not collect, store, or transmit any personal information. Your draft simulations, team selections, and trade history exist only in your browser's memory and are cleared when you close the page.</p>
        </section>

        <section className={styles.section}>
          <h2>Cookies and Tracking</h2>
          <p>We do not use cookies for tracking purposes. Third-party advertising partners (such as Google AdSense) may use cookies to serve relevant ads. You can manage cookie preferences through your browser settings.</p>
        </section>

        <section className={styles.section}>
          <h2>Third-Party Advertising</h2>
          <p>We use Google AdSense to display advertisements. Google may use cookies and web beacons to serve ads based on your prior visits to this and other websites. You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</p>
          <p>For more information about how Google uses data, visit <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google's Privacy & Terms</a>.</p>
        </section>

        <section className={styles.section}>
          <h2>External Links</h2>
          <p>The Source Scraper feature allows you to fetch content from external URLs you provide. We do not log or store these URLs. Content is fetched directly from your browser or through a CORS proxy service and is not retained.</p>
        </section>

        <section className={styles.section}>
          <h2>Data Sharing</h2>
          <p>We do not sell, trade, or otherwise transfer any information to third parties. The Share Picks feature generates a local image file on your device — no data is uploaded to our servers.</p>
        </section>

        <section className={styles.section}>
          <h2>Google DART Cookies</h2>
          <p>Google, as a third-party vendor, uses the DART cookie to serve ads based on your visits to this site and other sites on the Internet. You may opt out of the use of the DART cookie by visiting the Google Ad and Content Network privacy policy at <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">https://policies.google.com/technologies/ads</a>.</p>
        </section>

        <section className={styles.section}>
          <h2>Your Rights (GDPR/CCPA)</h2>
          <p>If you are a resident of the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR). If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA).</p>
          <p>Since we do not collect or store personal information, these rights are largely not applicable. However, for any questions regarding data processed by third-party advertising partners, you may contact Google directly through their privacy portal.</p>
        </section>

        <section className={styles.section}>
          <h2>Consent</h2>
          <p>By using this website, you consent to our Privacy Policy and agree to its terms. If you do not agree with this policy, please do not use our site.</p>
        </section>

        <section className={styles.section}>
          <h2>Children's Privacy</h2>
          <p>This site is not directed at children under 13. We do not knowingly collect information from children under 13. If you believe a child has provided us with personal information, please contact us so we can take appropriate action.</p>
        </section>

        <section className={styles.section}>
          <h2>Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date at the top. You are advised to review this privacy policy periodically for any changes.</p>
        </section>

        <section className={styles.section}>
          <h2>Contact</h2>
          <p>If you have questions about this privacy policy, please reach out via the <a href="https://github.com/campeterson41/nfl-mock-draft-2026" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>
        </section>
      </div>
      <SiteFooter />
    </div>
  )
}
