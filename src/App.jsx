import { useState, Component } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { DraftProvider } from './context/DraftContext.jsx'
import SessionSetup from './components/SessionSetup/SessionSetup.jsx'
import DraftRoom from './components/DraftRoom/DraftRoom.jsx'
import ResultsScreen from './components/ResultsScreen/ResultsScreen.jsx'
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy.jsx'
import AboutPage from './components/AboutPage/AboutPage.jsx'
import AppNav from './components/AppNav/AppNav.jsx'
import styles from './App.module.css'

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
        <div style={{ padding: 32, color: '#fafafa', background: '#09090b', minHeight: '100vh', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>2026 NFL Mock Draft Simulator</h1>
          <p style={{ color: '#a1a1aa', marginBottom: 24 }}>Something went wrong during the draft simulation.</p>
          <h2 style={{ color: '#ef4444', marginBottom: 16, fontSize: 16 }}>Error details:</h2>
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
          <p style={{ color: '#3f3f46', fontSize: 12, marginTop: 32 }}>
            <a href="/about" style={{ color: '#52525b' }}>About</a> &middot; <a href="/privacy" style={{ color: '#52525b' }}>Privacy Policy</a>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function DraftApp() {
  const navigate = useNavigate()
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
    setSessionKey(k => k + 1)
    setPhase('draft')
  }

  function handleNewSession() {
    setSessionKey(k => k + 1)
    setSessionConfig(null)
    setScraperOpen(false)
    setSessionIntelCount(0)
    setPhase('setup')
  }

  function handleIntelAdded(count) {
    setSessionIntelCount(prev => prev + count)
  }

  const showNav = phase !== 'setup'

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
            onPrivacy={() => navigate('/privacy')}
            onAbout={() => navigate('/about')}
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

function AboutRoute() {
  const navigate = useNavigate()
  return <AboutPage onBack={() => navigate('/')} />
}

function PrivacyRoute() {
  const navigate = useNavigate()
  return <PrivacyPolicy onBack={() => navigate('/')} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DraftApp />} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="/privacy" element={<PrivacyRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
