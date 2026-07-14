import { useState } from 'react'
import { CalculatorScreen } from './components/CalculatorScreen'
import { IntakeScreen } from './components/IntakeScreen'
import { useIntake } from './state/useIntake'

// Dev-only entry override (?screen=calculator) for local testing/screenshots.
// import.meta.env.DEV is compiled to false in production builds, so the
// intake gate cannot be bypassed on the deployed app.
const devInitialPhase: 'intake' | 'calculator' =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('screen') === 'calculator'
    ? 'calculator'
    : 'intake'

function App() {
  const intake = useIntake()
  const [phase, setPhase] = useState<'intake' | 'calculator'>(devInitialPhase)

  if (phase === 'intake') {
    return (
      <IntakeScreen intake={intake} onOpenCalculator={() => setPhase('calculator')} />
    )
  }

  return (
    <CalculatorScreen
      customerName={intake.fields.name}
      onBackToIntake={() => setPhase('intake')}
    />
  )
}

export default App
