import { useState, Component } from 'react'
import { DraftProvider } from './context/DraftContext.jsx'
import SessionSetup from './components/SessionSetup/SessionSetup.jsx'
import DraftRoom from './components/DraftRoom/DraftRoom.jsx'
import ResultsScreen from './components/ResultsScreen/ResultsScreen.jsx'
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy.jsx'
import AppNav from './components/AppNav/AppNav.jsx'
import styles from './App.module.css'

// Error boundary to catch render crashes and show the actual error
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('Draft crash:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#fafafa', background: '#09090b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', marginBottom: 16 }}>Draft crashed — error details:</h2>
          <pre style={{ color: '#fca5a5', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ color: '#71717a', fontSize: 11, whiteSpace: 'pre-wrap', marginBottom: 24 }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null, info: null }); this.props.onReset?.() }}
            style={{ padding: '8px 20px', background: '#d4a843', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            BACK TO SETUP
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [phase, setPhase] = useState('setup')
  const [sessionConfig, setSessionConfig] = useState(null)
  const [scraperOpen, setScraperOpen] = useState(false)
  const [sessionIntelCount, setSessionIntelCount] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)

  function handleSessionStart(config) {
    setSessionConfig(config)
    setSessionIntelCount(0)
    setPhase('draft')
  }

  function handleDraftComplete() {
    setPhase('results')
  }

  function handleResim() {
    // Increment key to force DraftProvider + hook to remount fresh
    setSessionKey(k => k + 1)
    setPhase('draft')
  }

  function handleNewSession() {
    // Increment key so DraftProvider fully remounts — clears all draft state
    setSessionKey(k => k + 1)
    setSessionConfig(null)
    setScraperOpen(false)
    setSessionIntelCount(0)
    setPhase('setup')
  }

  function handleIntelAdded(count) {
    setSessionIntelCount(prev => prev + count)
  }

  const showNav = phase !== 'setup' && phase !== 'privacy'

  if (phase === 'privacy') {
    return <PrivacyPolicy onBack={() => setPhase('setup')} />
  }

  return (
    <DraftProvider key={sessionKey} sessionConfig={sessionConfig}>
      <div className={`${styles.app} ${showNav ? styles.appWithNav : ''}`}>
        {showNav && (
          <AppNav
            onHome={handleNewSession}
            onOpenScraper={() => setScraperOpen(true)}
            sessionIntelCount={sessionIntelCount}
          />
        )}
        {phase === 'setup' && (
          <SessionSetup
            onStart={handleSessionStart}
            onPrivacy={() => setPhase('privacy')}
          />
        )}
        {phase === 'draft' && (
          <ErrorBoundary onReset={handleNewSession}>
            <DraftRoom
              onComplete={handleDraftComplete}
              onResim={handleResim}
              scraperOpen={scraperOpen}
              onScraperClose={() => setScraperOpen(false)}
              onIntelAdded={handleIntelAdded}
            />
          </ErrorBoundary>
        )}
        {phase === 'results' && (
          <ErrorBoundary onReset={handleNewSession}>
            <ResultsScreen
              onResim={handleResim}
              onNewSession={handleNewSession}
            />
          </ErrorBoundary>
        )}
      </div>
    </DraftProvider>
  )
}
