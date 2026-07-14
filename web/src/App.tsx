import { useState } from 'react'
import { CalculatorScreen } from './components/CalculatorScreen'
import { DealSummaryScreen, type DealDecision } from './components/DealSummaryScreen'
import { IntakeScreen } from './components/IntakeScreen'
import { useCart } from './state/useCart'
import { useConfig } from './state/useConfig'
import { useIntake } from './state/useIntake'
import { useSession } from './state/useSession'

type Phase = 'intake' | 'calculator' | 'summary' | 'decided'

// Dev-only entry override (?screen=calculator|summary) for local testing and
// screenshots. import.meta.env.DEV is compiled to false in production builds,
// so the intake gate cannot be bypassed on the deployed app.
const devInitialPhase: Phase = (() => {
  if (!import.meta.env.DEV) return 'intake'
  const screen = new URLSearchParams(window.location.search).get('screen')
  return screen === 'calculator' || screen === 'summary' ? screen : 'intake'
})()

function App() {
  const intake = useIntake()
  const config = useConfig()
  const cart = useCart()
  const session = useSession()
  const [phase, setPhase] = useState<Phase>(devInitialPhase)
  const [decision, setDecision] = useState<DealDecision | null>(null)

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
        spot={config.spot ?? session.lastCalc?.spot ?? null}
        margins={config.margins}
        onBack={() => setPhase('calculator')}
        onDecision={(d) => {
          setDecision(d)
          setPhase('decided')
        }}
      />
    )
  }

  if (phase === 'decided') {
    // Placeholder until the acceptance flow (2.6) and decline flow (2.7)
    // land: payment selector, signature, offer-letter PDF, price lock.
    const accepted = decision === 'accept'
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-8 text-center">
        <div
          className={`text-5xl mb-4 ${accepted ? '' : 'grayscale'}`}
          aria-hidden="true"
        >
          {accepted ? '✅' : '🕐'}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {accepted ? 'Deal Accepted' : 'Deal Declined'}
        </h1>
        <p className="text-slate-600 max-w-md mb-8">
          {accepted
            ? 'Next in the build: payment method, customer signature, and the offer-letter PDF (acceptance flow, Section 2.6).'
            : 'Next in the build: 24-hour price lock and the declined-deal webhook (decline flow, Section 2.7).'}
        </p>
        <button
          onClick={() => setPhase('summary')}
          className="min-h-12 px-6 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          ‹ Back to summary
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
