import SiteFooter from '../SiteFooter/SiteFooter.jsx'
import styles from './AboutPage.module.css'

export default function AboutPage({ onBack }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={onBack}>← Back to Draft</button>

        <h1 className={styles.title}>About the 2026 NFL Mock Draft Simulator</h1>

        <section className={styles.section}>
          <p className={styles.lead}>
            The most accurate mock draft simulator for the 2026 NFL Draft, powered by real beat writer
            intelligence and national analyst consensus. Built for fans who want more than guesswork.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What Makes This Different</h2>
          <p>
            Most mock draft tools use simple rankings to assign players to teams. Our simulator goes
            deeper. Every pick is driven by a weighted algorithm that factors in real reporting from
            over 300 beat writers and national analysts, actual team needs based on current rosters
            and free agency moves, regime tendencies for each front office, and verified pre-draft
            visit data.
          </p>
          <p>
            When a beat writer like Jim Wyatt reports that the Titans are "very interested" in a
            prospect, or when Daniel Jeremiah and Peter Schrager both confirm on their podcast that
            a player won't fall past a certain pick, that intel gets weighted into the algorithm.
            The result is a simulation that reflects what teams are actually thinking, not just
            what looks good on a big board.
          </p>
        </section>

        <section className={styles.section}>
          <h2>The Algorithm</h2>
          <p>
            Each pick is determined by a desire score calculated for every available player on
            every team's board. The formula combines several components:
          </p>
          <ul>
            <li>
              <strong>Consensus Ranking</strong> — Player value follows an exponential decay curve
              based on the PFSN industry consensus, which aggregates rankings from ESPN, PFF, CBS,
              The Athletic, NFL Network, Yahoo, and Bleacher Report. The gap between the #1 and #10
              prospect is much larger than the gap between #40 and #50.
            </li>
            <li>
              <strong>Team Needs</strong> — Every team's positional needs are sourced from post-free-agency
              analysis by ESPN, NFL.com, and PFF. Needs are blended with each team's BPA tendency,
              so teams known for drafting best player available (like Baltimore) won't reach for need
              while need-heavy teams will.
            </li>
            <li>
              <strong>Beat Writer Intelligence</strong> — Signals from team-specific reporters who
              cover their franchise daily. Insider language ("I'm hearing...", "sources tell me...")
              gets extra weight. Top-30 visit data provides concrete evidence of team interest.
            </li>
            <li>
              <strong>National Analyst Signals</strong> — Mock draft projections and insider reporting
              from the most connected analysts in the industry, including Daniel Jeremiah, Dane Brugler,
              Peter Schrager, Mel Kiper, and Todd McShay.
            </li>
            <li>
              <strong>Mock Range Constraints</strong> — Players can't go dramatically earlier than
              any major outlet projects them. A consensus third-round pick won't show up at #12
              overall just because a team needs that position.
            </li>
            <li>
              <strong>Gaussian Noise</strong> — Calibrated randomness ensures every simulation
              produces different results. The noise scales by draft position: more variance in
              later rounds where outcomes are less predictable.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>2026 NFL Draft Overview</h2>
          <p>
            The 2026 NFL Draft takes place April 23-25, 2026 in Pittsburgh, Pennsylvania at the
            Steelers' home stadium. This year's class is highlighted by Indiana quarterback Fernando
            Mendoza, the consensus #1 overall pick, along with a deep group of edge rushers and
            linebackers. The quarterback class is considered weaker than recent years, with Mendoza
            as the only likely first-round signal-caller.
          </p>
          <p>
            Notable storylines include the Jets' rebuild under Aaron Glenn with two first-round picks,
            the Cardinals potentially resetting at quarterback after releasing Kyler Murray, and the
            Lions looking to replace left tackle Taylor Decker. The trade market is expected to be
            active, with several teams holding multiple first-round selections.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Data Sources</h2>
          <p>
            Player rankings are sourced from the PFSN Industry Consensus Big Board, which aggregates
            rankings from nine major outlets: PFSN, Bleacher Report, CBS Sports, ESPN, PFF, The Athletic,
            Todd McShay, Yahoo Sports, and Daniel Jeremiah. Team needs are cross-referenced from
            ESPN's draft needs analysis, NFL.com's team-by-team breakdown, and PFF's post-free-agency
            needs reports.
          </p>
          <p>
            Beat writer data includes reporters from The Athletic, ESPN, NFL Network, CBS Sports,
            local newspapers, team websites, and independent outlets covering all 32 NFL teams.
            Pre-draft visit information is aggregated from public reporting by team beat writers
            and verified against official team announcements where available.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Features</h2>
          <ul>
            <li>491 verified prospects from the PFSN industry consensus</li>
            <li>All 7 rounds (257 picks) with official NFL compensatory pick order</li>
            <li>Full trade system using the Jimmy Johnson draft value chart</li>
            <li>Three draft modes: single team, multi-team, and full auto-sim</li>
            <li>Real-time source scraper with domain vetting and recency weighting</li>
            <li>Shareable draft class images</li>
            <li>Mobile-friendly interface</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Frequently Asked Questions</h2>

          <h3>Why does the same player go to the same team most of the time?</h3>
          <p>
            Strong insider signals (confirmed visits, beat writer reports) create a realistic lean
            toward certain outcomes. In real NFL drafts, most first-round picks are predictable
            based on pre-draft reporting. The algorithm balances this accuracy with enough randomness
            that each sim feels different, especially in rounds 2-7 where information is less certain.
          </p>

          <h3>Can I trade?</h3>
          <p>
            Yes. Click the Trade button at any point during the draft. You can trade with any team,
            offering current draft picks and 2027 future picks. The AI evaluates trades using the
            Jimmy Johnson value chart and will accept, counter, or decline based on the value exchanged.
          </p>

          <h3>How often is the data updated?</h3>
          <p>
            Player rankings and team needs are updated regularly throughout the pre-draft process
            as new information becomes available from free agency, pro days, private workouts, and
            beat writer reporting.
          </p>

          <h3>Why doesn't a player go where I expect?</h3>
          <p>
            The algorithm weighs multiple factors that may conflict. A player might be a great fit
            for a team's needs but have strong insider signals linking them elsewhere. Or a team's
            BPA tendency might cause them to pass on a need position for a higher-ranked prospect.
            This reflects the real complexity of NFL draft decisions.
          </p>
        </section>

      </div>
      <SiteFooter />
    </div>
  )
}
