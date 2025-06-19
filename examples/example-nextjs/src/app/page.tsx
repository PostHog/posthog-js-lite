'use client'
import { usePostHog } from 'posthog-js/react'

export default function Home() {
  const posthog = usePostHog()
  return (
    <div>
      <main>
        <div>
          <button onClick={() => posthog.captureException(new Error('button_clicked'))}>Click me!</button>
        </div>
      </main>
    </div>
  )
}
