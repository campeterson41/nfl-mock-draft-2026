import { useState } from 'react'
import MockDrawer from './MockDrawer.jsx'
import styles from './GroupLeaderboard.module.css'

function summaryOf(breakdown) {
  let exact = 0, near = 0, position = 0, trade = 0
  for (const line of breakdown ?? []) {
    if (line.type === 'exact')    exact++
    else if (line.type === 'near')     near++
    else if (line.type === 'position') position++
    else if (line.type === 'trade')    trade++
  }
  return { exact, near, position, trade }
}

export default function GroupLeaderboard({ ranked, actuals }) {
  const [openName, setOpenName] = useState(null)

  // Count only picks with a real playerId — empty teamId-only skeletons
  // from the admin UI's R1 pre-seed don't count as "official picks".
  const actualPickCount  = Object.values(actuals?.picks ?? {}).filter(p => p?.playerId).length
  const actualTradeCount = (actuals?.trades ?? []).length

  const openEntry = openName
    ? ranked.find((e) => e.submission.name === openName)
    : null
  const openRank = openEntry ? ranked.indexOf(openEntry) + 1 : null

  return (
    <>
      <section className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>LEADERBOARD</h2>
          <p className={styles.subtitle}>
            Scored against {actualPickCount} official pick{actualPickCount === 1 ? '' : 's'}
            {actualTradeCount > 0 && ` and ${actualTradeCount} trade${actualTradeCount === 1 ? '' : 's'}`}.
            {' '}Tap a member to see their full mock.
          </p>
        </div>

        {ranked.length === 0 ? (
          <p className={styles.empty}>No submissions were made for this group.</p>
        ) : (
          <ol className={styles.list}>
            {ranked.map((entry, idx) => {
              const summary = summaryOf(entry.score.breakdown)
              return (
                <li
                  key={entry.submission.name}
                  className={`${styles.row} ${idx === 0 ? styles.rowFirst : ''}`}
                >
                  <button
                    className={styles.rowSummary}
                    onClick={() => setOpenName(entry.submission.name)}
                  >
                    <span className={styles.rank}>{idx + 1}</span>
                    <span className={styles.name}>{entry.submission.name}</span>
                    <span className={styles.hits}>
                      {summary.exact > 0    && <span className={styles.hitExact}>{summary.exact} exact</span>}
                      {summary.near > 0     && <span className={styles.hitNear}>{summary.near} close</span>}
                      {summary.position > 0 && <span className={styles.hitPos}>{summary.position} pos</span>}
                      {summary.trade > 0    && <span className={styles.hitTrade}>{summary.trade} trade</span>}
                    </span>
                    <span className={styles.total}>{entry.score.total} pts</span>
                    <span className={styles.chevron}>›</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <MockDrawer
        open={!!openEntry}
        onClose={() => setOpenName(null)}
        submission={openEntry?.submission}
        score={openEntry?.score}
        rank={openRank}
        actuals={actuals}
        draftStarted
      />
    </>
  )
}
