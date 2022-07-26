import express from 'express'
import PostHog from 'posthog-node'

const app = express()

const posthog = new PostHog('phc_FzKQvNvps9ZUTxF5KJR9jIKdGb4bq4HNBa9SRyAHi0C', {
  host: 'http://localhost:8000',
  flushAt: 10,
})

app.get('/', (req, res) => {
  posthog.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'legacy capture' })
  res.send({ hello: 'world' })
})

app.get('/user/:userId/action', (req, res) => {
  posthog.capture({ distinctId: req.params.userId, event: 'user did action', properties: req.params })

  res.send({ status: 'ok' })
})

const server = app.listen(8010, () => {
  console.log('⚡: Server is running at http://localhost:8010')
})

async function handleExit(signal: any) {
  console.log(`Received ${signal}. Flushing...`)
  await posthog.shutdownAsync()
  console.log(`Flush complete`)
  server.close(() => {
    process.exit(0)
  })
}
process.on('SIGINT', handleExit)
process.on('SIGQUIT', handleExit)
process.on('SIGTERM', handleExit)
