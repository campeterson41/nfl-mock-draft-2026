import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getActuals,
  updateActuals,
  adminListGroups,
  adminDeleteGroup,
  adminDeleteSubmission,
} from '../../lib/groupApi.js'
import playersData from '../../data/players.json'
import picksData from '../../data/picks.json'
import teamsData from '../../data/teams.json'
import styles from './AdminPage.module.css'

const SECRET_STORAGE_KEY = 'nfldraft_admin_secret'
const ALL_TEAMS = Object.values(teamsData).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))

function playerLabel(id) {
  const p = playersData.find(x => x.id === id)
  if (!p) return id
  return `#${p.rank} ${p.name} — ${p.position} (${p.school})`
}

// Lightweight player autocomplete picker
function PlayerPicker({ value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return playersData.slice(0, 40)
    const q = search.trim().toLowerCase()
    return playersData
      .filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .slice(0, 40)
  }, [search])

  const selected = value ? playersData.find(p => p.id === value) : null

  return (
    <div className={styles.pickerWrap}>
      {!open ? (
        <button
          type="button"
          className={styles.pickerBtn}
          onClick={() => setOpen(true)}
        >
          {selected ? playerLabel(selected.id) : 'Select player…'}
        </button>
      ) : (
        <div className={styles.pickerPopover}>
          <input
            autoFocus
            type="text"
            className={styles.pickerInput}
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          <div className={styles.pickerList}>
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={styles.pickerItem}
                onClick={() => { onChange(p.id); setOpen(false); setSearch('') }}
              >
                {playerLabel(p.id)}
              </button>
            ))}
            {filtered.length === 0 && <div className={styles.pickerEmpty}>No matches.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function PickRow({ overall, picks, onChangePlayer, onChangeTeam, onRemove }) {
  const pick = picksData.picks.find(p => p.overall === overall)
  const currentEntry = picks[String(overall)] || { playerId: '', teamId: pick?.teamId ?? '' }

  return (
    <div className={styles.pickRow}>
      <div className={styles.pickMeta}>
        <span className={styles.pickRound}>R{pick?.round ?? '?'}</span>
        <span className={styles.pickNumber}>#{overall}</span>
      </div>
      <PlayerPicker
        value={currentEntry.playerId}
        onChange={(playerId) => onChangePlayer(overall, playerId)}
      />
      <select
        className={styles.teamSelect}
        value={currentEntry.teamId}
        onChange={(e) => onChangeTeam(overall, e.target.value)}
      >
        <option value="">Team…</option>
        {ALL_TEAMS.map(t => (
          <option key={t.id} value={t.id}>{t.abbreviation}</option>
        ))}
      </select>
      <button type="button" className={styles.removeBtn} onClick={() => onRemove(overall)}>×</button>
    </div>
  )
}

function TradeRow({ idx, trade, onChange, onRemove }) {
  function set(patch) {
    onChange(idx, { ...trade, ...patch })
  }
  function parseNums(str) {
    return str.split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0 && n <= 257)
  }
  return (
    <div className={styles.tradeCard}>
      <div className={styles.tradeHeader}>
        <span className={styles.tradeLabel}>TRADE {idx + 1}</span>
        <button type="button" className={styles.removeBtn} onClick={() => onRemove(idx)}>× Remove</button>
      </div>
      <div className={styles.tradeTeams}>
        <label>
          <span className={styles.fieldLabel}>Team A</span>
          <select value={trade.teamAId} onChange={e => set({ teamAId: e.target.value })}>
            <option value="">Team…</option>
            {ALL_TEAMS.map(t => <option key={t.id} value={t.id}>{t.abbreviation}</option>)}
          </select>
        </label>
        <span className={styles.tradeArrow}>⇄</span>
        <label>
          <span className={styles.fieldLabel}>Team B</span>
          <select value={trade.teamBId} onChange={e => set({ teamBId: e.target.value })}>
            <option value="">Team…</option>
            {ALL_TEAMS.map(t => <option key={t.id} value={t.id}>{t.abbreviation}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.tradeRow}>
        <label>
          <span className={styles.fieldLabel}>A sent (pick #s)</span>
          <input
            type="text"
            placeholder="e.g. 9, 45"
            value={trade.aSentRaw ?? (trade.aSent?.pickOveralls ?? []).join(', ')}
            onChange={e => set({ aSentRaw: e.target.value, aSent: { pickOveralls: parseNums(e.target.value), futurePickIds: [] } })}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>B sent (pick #s)</span>
          <input
            type="text"
            placeholder="e.g. 22, 78"
            value={trade.bSentRaw ?? (trade.bSent?.pickOveralls ?? []).join(', ')}
            onChange={e => set({ bSentRaw: e.target.value, bSent: { pickOveralls: parseNums(e.target.value), futurePickIds: [] } })}
          />
        </label>
      </div>
    </div>
  )
}

function teamLabel(teamId) {
  const t = teamsData[teamId]
  return t ? `${t.city} ${t.nickname}` : teamId
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

/**
 * Groups management section — admin-only list, search, delete whole groups,
 * delete individual submissions. Reads from /api/admin/groups on mount; every
 * destructive action refetches so the list stays truthy.
 */
function GroupsSection({ secret, onAuthFailure }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [busy, setBusy] = useState(() => new Set())

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminListGroups(secret)
      setGroups(res?.groups ?? [])
    } catch (err) {
      if (err.status === 401) {
        onAuthFailure?.()
        return
      }
      setError(err?.message ?? 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [secret, onAuthFailure])

  useEffect(() => { refresh() }, [refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g =>
      (g.name ?? '').toLowerCase().includes(q) ||
      (g.id ?? '').toLowerCase().includes(q) ||
      (g.commissionerName ?? '').toLowerCase().includes(q) ||
      (g.teamId ?? '').toLowerCase().includes(q) ||
      teamLabel(g.teamId).toLowerCase().includes(q) ||
      (g.submissions ?? []).some(s => (s.name ?? '').toLowerCase().includes(q))
    )
  }, [groups, search])

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function markBusy(key, on) {
    setBusy(prev => {
      const next = new Set(prev)
      if (on) next.add(key); else next.delete(key)
      return next
    })
  }

  async function handleDeleteGroup(group) {
    const confirmMsg = `Permanently delete group "${group.name}" (${group.id})?\n\n${group.submissionCount} submission${group.submissionCount === 1 ? '' : 's'} will also be lost. This cannot be undone.`
    if (!window.confirm(confirmMsg)) return
    const key = `g:${group.id}`
    markBusy(key, true)
    try {
      await adminDeleteGroup(secret, group.id)
      await refresh()
    } catch (err) {
      if (err.status === 401) { onAuthFailure?.(); return }
      alert(err?.message ?? 'Delete failed')
    } finally {
      markBusy(key, false)
    }
  }

  async function handleDeleteSubmission(groupId, name) {
    if (!window.confirm(`Delete submission by "${name}"? This cannot be undone.`)) return
    const key = `s:${groupId}:${name}`
    markBusy(key, true)
    try {
      await adminDeleteSubmission(secret, groupId, name)
      await refresh()
    } catch (err) {
      if (err.status === 401) { onAuthFailure?.(); return }
      alert(err?.message ?? 'Delete failed')
    } finally {
      markBusy(key, false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>GROUPS ({groups.length})</h2>
        <div className={styles.groupsControls}>
          <input
            type="text"
            className={styles.groupSearch}
            placeholder="Search by name, id, team, member…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button type="button" className={styles.secondaryBtn} onClick={refresh} disabled={loading}>
            {loading ? 'LOADING…' : 'REFRESH'}
          </button>
        </div>
      </div>

      {error && <p className={styles.saveErr}>{error}</p>}

      {loading && groups.length === 0 ? (
        <p className={styles.empty}>Loading groups…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {groups.length === 0 ? 'No groups yet.' : 'No groups match that search.'}
        </p>
      ) : (
        <div className={styles.groupList}>
          {filtered.map(g => {
            const isExpanded = expanded.has(g.id)
            const groupKey = `g:${g.id}`
            const isDeleting = busy.has(groupKey)
            return (
              <div key={g.id} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <button
                    type="button"
                    className={styles.groupHeaderBtn}
                    onClick={() => toggleExpanded(g.id)}
                    title={isExpanded ? 'Collapse' : 'Expand submissions'}
                  >
                    <span className={styles.groupExpandArrow}>{isExpanded ? '▾' : '▸'}</span>
                    <div className={styles.groupHeaderText}>
                      <div className={styles.groupTitleRow}>
                        <span className={styles.groupName}>{g.name || '(unnamed)'}</span>
                        <span className={styles.groupId}>/{g.id}</span>
                      </div>
                      <div className={styles.groupMeta}>
                        <span>{teamLabel(g.teamId)}</span>
                        <span className={styles.groupMetaDot}>·</span>
                        <span>Commish: {g.commissionerName || '—'}</span>
                        <span className={styles.groupMetaDot}>·</span>
                        <span>{g.submissionCount} submission{g.submissionCount === 1 ? '' : 's'}</span>
                        <span className={styles.groupMetaDot}>·</span>
                        <span>Created {formatDate(g.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.groupDeleteBtn}
                    onClick={() => handleDeleteGroup(g)}
                    disabled={isDeleting}
                    title="Delete this entire group"
                  >
                    {isDeleting ? 'DELETING…' : 'DELETE GROUP'}
                  </button>
                </div>

                {isExpanded && (
                  <div className={styles.submissionList}>
                    {(g.submissions ?? []).length === 0 ? (
                      <p className={styles.submissionEmpty}>No submissions yet.</p>
                    ) : (
                      g.submissions.map(s => {
                        const subKey = `s:${g.id}:${s.name}`
                        const subBusy = busy.has(subKey)
                        return (
                          <div key={s.name} className={styles.submissionRow}>
                            <div className={styles.submissionInfo}>
                              <span className={styles.submissionName}>{s.name}</span>
                              <span className={styles.submissionDate}>{formatDate(s.submittedAt)}</span>
                            </div>
                            <button
                              type="button"
                              className={styles.submissionDeleteBtn}
                              onClick={() => handleDeleteSubmission(g.id, s.name)}
                              disabled={subBusy}
                              title={`Delete submission by ${s.name}`}
                            >
                              {subBusy ? '…' : '× Remove'}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function AdminPage() {
  const navigate = useNavigate()

  const [secret, setSecret] = useState(() => localStorage.getItem(SECRET_STORAGE_KEY) ?? '')
  const [secretInput, setSecretInput] = useState('')
  const [authError, setAuthError] = useState(null)

  const [picks, setPicks] = useState({})      // { [overall]: { playerId, teamId } }
  const [trades, setTrades] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [newPickOverall, setNewPickOverall] = useState('')

  // Helper: build a map of empty picks for all overalls in a given round.
  function seedRound(round) {
    const out = {}
    for (const p of picksData.picks.filter(x => x.round === round)) {
      out[String(p.overall)] = { playerId: '', teamId: p.teamId }
    }
    return out
  }

  // Load current actuals on mount. If nothing is saved yet, pre-seed Round 1
  // so the admin has 32 empty pick rows ready to fill in.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const doc = await getActuals()
        if (cancelled) return
        const loaded = doc.picks ?? {}
        if (Object.keys(loaded).length === 0) {
          setPicks(seedRound(1))
        } else {
          setPicks(loaded)
        }
        setTrades((doc.trades ?? []).map(t => ({ ...t })))
        setLastUpdated(doc.lastUpdated)
      } catch (err) {
        // non-fatal; fall back to pre-seeded R1
        if (!cancelled) setPicks(seedRound(1))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleUnlock() {
    const trimmed = secretInput.trim()
    if (!trimmed) return
    setSecret(trimmed)
    localStorage.setItem(SECRET_STORAGE_KEY, trimmed)
    setSecretInput('')
    setAuthError(null)
  }

  function handleSignOut() {
    localStorage.removeItem(SECRET_STORAGE_KEY)
    setSecret('')
  }

  function addPick() {
    const overall = parseInt(newPickOverall, 10)
    if (!Number.isInteger(overall) || overall < 1 || overall > 257) return
    if (picks[String(overall)]) return  // already exists
    const pick = picksData.picks.find(p => p.overall === overall)
    setPicks(prev => ({
      ...prev,
      [String(overall)]: { playerId: '', teamId: pick?.teamId ?? '' },
    }))
    setNewPickOverall('')
  }

  function removePick(overall) {
    setPicks(prev => {
      const next = { ...prev }
      delete next[String(overall)]
      return next
    })
  }

  function addRound(round) {
    setPicks(prev => ({ ...prev, ...seedRound(round) }))
  }

  function changePickPlayer(overall, playerId) {
    setPicks(prev => ({
      ...prev,
      [String(overall)]: { ...(prev[String(overall)] ?? {}), playerId },
    }))
  }
  function changePickTeam(overall, teamId) {
    setPicks(prev => ({
      ...prev,
      [String(overall)]: { ...(prev[String(overall)] ?? {}), teamId },
    }))
  }

  function addTrade() {
    setTrades(prev => [...prev, {
      teamAId: '', teamBId: '',
      aSent: { pickOveralls: [], futurePickIds: [] },
      bSent: { pickOveralls: [], futurePickIds: [] },
    }])
  }
  function changeTrade(idx, next) {
    setTrades(prev => prev.map((t, i) => (i === idx ? next : t)))
  }
  function removeTrade(idx) {
    setTrades(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!secret) return
    setSaving(true)
    setSaveMsg(null)
    setAuthError(null)
    try {
      // Drop UI-only helper fields before sending
      const cleanTrades = trades.map(({ aSentRaw, bSentRaw, ...rest }) => rest)  // eslint-disable-line no-unused-vars
      const res = await updateActuals(secret, { picks, trades: cleanTrades })
      setLastUpdated(res.lastUpdated)
      setSaveMsg({ kind: 'ok', text: 'Saved. Group leaderboards will reflect this on next load.' })
    } catch (err) {
      if (err.status === 401) {
        setAuthError('That password is not correct. Try again.')
        setSecret('')
        localStorage.removeItem(SECRET_STORAGE_KEY)
      } else {
        setSaveMsg({ kind: 'error', text: err?.message ?? 'Save failed' })
      }
    } finally {
      setSaving(false)
    }
  }

  // Password gate
  if (!secret) {
    return (
      <div className={styles.page}>
        <div className={styles.gateBox}>
          <p className={styles.gateEyebrow}>ADMIN ACCESS</p>
          <h1 className={styles.gateTitle}>Enter draft admin password</h1>
          <p className={styles.gateHint}>
            This page lets the draft admin enter the real-draft results. Group leaderboards score against what you save here.
          </p>
          <input
            type="password"
            className={styles.gateInput}
            placeholder="Password"
            value={secretInput}
            onChange={e => setSecretInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
          {authError && <p className={styles.gateError}>{authError}</p>}
          <div className={styles.gateActions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/')}>← Back to home</button>
            <button className={styles.primaryBtn} onClick={handleUnlock} disabled={!secretInput.trim()}>
              UNLOCK
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Sorted list of overalls we're editing
  const sortedOveralls = Object.keys(picks).map(Number).sort((a, b) => a - b)

  // Which rounds are already fully seeded (so we can gray out the "ADD R#" button)
  const roundFullySeeded = {}
  for (let r = 1; r <= 7; r++) {
    const roundPicks = picksData.picks.filter(p => p.round === r)
    roundFullySeeded[r] = roundPicks.length > 0 && roundPicks.every(p => picks[String(p.overall)])
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>DRAFT ADMIN</p>
            <h1 className={styles.title}>Enter Actual Draft Results</h1>
            <p className={styles.subtitle}>
              {loading ? 'Loading…' : lastUpdated
                ? `Last saved: ${new Date(lastUpdated).toLocaleString()}`
                : 'Nothing saved yet — the leaderboard is inactive until you save at least one pick or trade.'}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={handleSignOut}>Sign out</button>
            <button
              className={styles.primaryBtn}
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? 'SAVING…' : 'SAVE CHANGES'}
            </button>
          </div>
        </header>

        {saveMsg && (
          <p className={saveMsg.kind === 'ok' ? styles.saveOk : styles.saveErr}>{saveMsg.text}</p>
        )}

        {/* ── Groups ── */}
        <GroupsSection
          secret={secret}
          onAuthFailure={() => {
            setAuthError('That password is not correct. Try again.')
            setSecret('')
            localStorage.removeItem(SECRET_STORAGE_KEY)
          }}
        />

        {/* ── Picks ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>PICKS ({sortedOveralls.length})</h2>
            <div className={styles.addRow}>
              <input
                type="number"
                className={styles.addInput}
                placeholder="Pick # (1–257)"
                value={newPickOverall}
                onChange={e => setNewPickOverall(e.target.value)}
                min={1}
                max={257}
              />
              <button type="button" className={styles.addBtn} onClick={addPick}>+ ADD PICK</button>
            </div>
          </div>

          {/* Quick-add whole rounds */}
          <div className={styles.roundRow}>
            <span className={styles.roundRowLabel}>QUICK ADD ROUND</span>
            {[1, 2, 3, 4, 5, 6, 7].map(r => (
              <button
                key={r}
                type="button"
                className={`${styles.roundBtn} ${roundFullySeeded[r] ? styles.roundBtnDone : ''}`}
                disabled={roundFullySeeded[r]}
                onClick={() => addRound(r)}
                title={roundFullySeeded[r] ? `Round ${r} already loaded` : `Add all Round ${r} picks`}
              >
                R{r}
              </button>
            ))}
          </div>

          {sortedOveralls.length === 0 ? (
            <p className={styles.empty}>No picks entered yet. Add one above.</p>
          ) : (
            <div className={styles.pickList}>
              {sortedOveralls.map(overall => (
                <PickRow
                  key={overall}
                  overall={overall}
                  picks={picks}
                  onChangePlayer={changePickPlayer}
                  onChangeTeam={changePickTeam}
                  onRemove={removePick}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Trades ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>TRADES ({trades.length})</h2>
            <button type="button" className={styles.addBtn} onClick={addTrade}>+ ADD TRADE</button>
          </div>

          {trades.length === 0 ? (
            <p className={styles.empty}>No trades entered yet.</p>
          ) : (
            <div className={styles.tradeList}>
              {trades.map((t, i) => (
                <TradeRow
                  key={i}
                  idx={i}
                  trade={t}
                  onChange={changeTrade}
                  onRemove={removeTrade}
                />
              ))}
            </div>
          )}
        </section>

        <div className={styles.footerActions}>
          <button className={styles.secondaryBtn} onClick={() => navigate('/')}>← Back to home</button>
          <button
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  )
}
