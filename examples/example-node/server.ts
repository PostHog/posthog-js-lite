import express from 'express'
import { PostHogNodejsGlobal } from 'posthog-node'

const app = express()

const posthog = new PostHogNodejsGlobal('phc_FzKQvNvps9ZUTxF5KJR9jIKdGb4bq4HNBa9SRyAHi0C', {
  host: 'http://localhost:8000',
  flushAt: 10,
})

app.get('/', (req, res) => {
  ;(posthog.user('EXAMPLE_APP_GLOBAL') as any).capture('home page loaded')
  res.send({ hello: 'world' })
})

app.get('/user/:userId/action', (req, res) => {
  ;(posthog.user(req.params.userId) as any).capture('user did action', req.params)
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
