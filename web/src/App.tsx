import { useEffect, useState } from 'react'
import { AcceptanceScreen } from './components/AcceptanceScreen'
import { CalculatorScreen } from './components/CalculatorScreen'
import { DealSummaryScreen } from './components/DealSummaryScreen'
import { DeclineScreen } from './components/DeclineScreen'
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
  | 'declining'
  | 'declined-done'

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
  const [priceLockExpiry, setPriceLockExpiry] = useState<Date | null>(null)

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
        dealExtras={intake.dealExtras}
        setDealExtra={intake.setDealExtra}
        onBack={() => setPhase('calculator')}
        onDecision={(d) => setPhase(d === 'accept' ? 'acceptance' : 'declining')}
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

  if (phase === 'declining') {
    return (
      <DeclineScreen
        intake={intake}
        lines={cart.lines}
        spot={spot}
        margins={config.margins}
        onBack={() => setPhase('summary')}
        onComplete={(result, _locked, expiresAt) => {
          setSubmitResult(result)
          setPriceLockExpiry(expiresAt)
          setPhase('declined-done')
        }}
      />
    )
  }

  if (phase === 'declined-done') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-8 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🕐</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Deal Declined</h1>
        {priceLockExpiry ? (
          <p className="text-slate-600 max-w-md mb-2">
            The offer is locked for this customer until{' '}
            <span className="font-semibold text-slate-900">
              {priceLockExpiry.toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            . If they return before then, the price stands.
          </p>
        ) : (
          <p className="text-slate-600 max-w-md mb-2">
            Recorded with no price lock — a returning visit reprices at live spot.
          </p>
        )}
        <p className="text-xs text-slate-500 mb-8">
          Declined-deal record{' '}
          {submitResult === 'delivered'
            ? 'sent to the back office.'
            : 'queued — will send automatically when connection returns.'}
        </p>
        <button
          onClick={startNewCustomer}
          className="min-h-12 px-8 rounded-md bg-slate-900 text-white text-base font-semibold hover:bg-slate-800"
        >
          New Customer
        </button>
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
