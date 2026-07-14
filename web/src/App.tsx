import { useEffect, useState } from 'react'
import { AcceptanceScreen } from './components/AcceptanceScreen'
import { CalculatorScreen } from './components/CalculatorScreen'
import { DealSummaryScreen } from './components/DealSummaryScreen'
import { IntakeScreen } from './components/IntakeScreen'
import { flushDealQueue, type SubmitResult } from './lib/dealSubmit'
import { useCart } from './state/useCart'
import { useConfig } from './state/useConfig'
import { useIntake } from './state/useIntake'
import { useSession } from './state/useSession'

type Phase =
  | 'intake'
  | 'calculator'
  | 'summary'
  | 'acceptance'
  | 'accepted-done'
  | 'declined'

// Dev-only entry override (?screen=calculator|summary|acceptance) for local
// testing and screenshots. import.meta.env.DEV is compiled to false in
// production builds, so the intake gate cannot be bypassed on the deployed app.
const devInitialPhase: Phase = (() => {
  if (!import.meta.env.DEV) return 'intake'
  const screen = new URLSearchParams(window.location.search).get('screen')
  return screen === 'calculator' || screen === 'summary' || screen === 'acceptance'
    ? screen
    : 'intake'
})()

function App() {
  const intake = useIntake()
  const config = useConfig()
  const cart = useCart()
  const session = useSession()
  const [phase, setPhase] = useState<Phase>(devInitialPhase)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  // Offline degradation (2.14): retry any queued deal submissions on start.
  useEffect(() => {
    void flushDealQueue()
  }, [])

  const spot = config.spot ?? session.lastCalc?.spot ?? null

  function startNewCustomer() {
    intake.reset()
    cart.clear()
    session.setLastCalc(null)
    setSubmitResult(null)
    setPhase('intake')
  }

  if (phase === 'intake') {
    return (
      <IntakeScreen intake={intake} onOpenCalculator={() => setPhase('calculator')} />
    )
  }

  if (phase === 'summary') {
    return (
      <DealSummaryScreen
        customerName={intake.fields.name || 'Customer'}
        lines={cart.lines}
        spot={spot}
        margins={config.margins}
        onBack={() => setPhase('calculator')}
        onDecision={(d) => setPhase(d === 'accept' ? 'acceptance' : 'declined')}
      />
    )
  }

  if (phase === 'acceptance') {
    return (
      <AcceptanceScreen
        intake={intake}
        lines={cart.lines}
        spot={spot}
        margins={config.margins}
        onBack={() => setPhase('summary')}
        onComplete={(result) => {
          setSubmitResult(result)
          setPhase('accepted-done')
        }}
      />
    )
  }

  if (phase === 'accepted-done') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-8 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">✅</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Deal Complete</h1>
        <p className="text-slate-600 max-w-md mb-2">
          Offer letter generated and the deal record{' '}
          {submitResult === 'delivered'
            ? 'was sent to the back office.'
            : 'is queued and will send automatically when connection returns.'}
        </p>
        {submitResult === 'queued' && (
          <p className="text-xs text-amber-700 font-medium mb-6">
            Queued locally — no data lost.
          </p>
        )}
        <button
          onClick={startNewCustomer}
          className="min-h-12 px-8 rounded-md bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700"
        >
          New Customer
        </button>
      </main>
    )
  }

  if (phase === 'declined') {
    // Placeholder until the decline flow (2.7) lands: 24-hour price lock and
    // the declined-deal webhook.
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-8 text-center">
        <div className="text-5xl mb-4 grayscale" aria-hidden="true">🕐</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Deal Declined</h1>
        <p className="text-slate-600 max-w-md mb-8">
          Next in the build: 24-hour price lock and the declined-deal webhook
          (decline flow, Section 2.7).
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('summary')}
            className="min-h-12 px-6 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            ‹ Back to summary
          </button>
          <button
            onClick={startNewCustomer}
            className="min-h-12 px-6 rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            New Customer
          </button>
        </div>
      </main>
    )
  }

  return (
    <CalculatorScreen
      config={config}
      cart={cart}
      session={session}
      customerName={intake.fields.name}
      onBackToIntake={() => setPhase('intake')}
      onReviewDeal={() => setPhase('summary')}
    />
  )
}

export default App
