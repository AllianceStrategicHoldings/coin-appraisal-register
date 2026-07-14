import { useState } from 'react'
import { CalculatorScreen } from './components/CalculatorScreen'
import { IntakeScreen } from './components/IntakeScreen'
import { useIntake } from './state/useIntake'

function App() {
  const intake = useIntake()
  const [phase, setPhase] = useState<'intake' | 'calculator'>('intake')

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
