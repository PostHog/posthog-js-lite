import express from 'express'
import { PostHog, PostHogSentryIntegration } from 'posthog-node'
import undici from 'undici'

import * as Sentry from '@sentry/node'

const app = express()

const {
  PH_API_KEY = 'YOUR API KEY',
  PH_HOST = 'http://127.0.0.1:8000',
  PH_PERSONAL_API_KEY = 'YOUR PERSONAL API KEY',
} = process.env

const posthog = new PostHog(PH_API_KEY, {
  host: PH_HOST,
  flushAt: 10,
  personalApiKey: PH_PERSONAL_API_KEY,
  // By default PostHog uses axios for fetch but you can specify your own implementation if preferred
  fetch(url, options) {
    console.log(url, options)
    return undici.fetch(url, options)
  },
})

posthog.debug()

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  integrations: [new PostHogSentryIntegration(posthog)],
})

app.get('/', (req, res) => {
  posthog.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'legacy capture' })
  res.send({ hello: 'world' })
})

app.get('/error', (req, res) => {
  Sentry.captureException(new Error('example error'), {
    tags: {
      [PostHogSentryIntegration.POSTHOG_ID_TAG]: 'EXAMPLE_APP_GLOBAL',
    },
  })
  res.send({ status: 'error!!' })
})

app.get('/user/:userId/action', (req, res) => {
  posthog.capture({ distinctId: req.params.userId, event: 'user did action', properties: req.params })

  res.send({ status: 'ok' })
})

app.get('/user/:userId/flags/:flagId', async (req, res) => {
  const flag = await posthog.getFeatureFlag('key-1', req.params.userId).catch((e) => console.error(e))

  res.send({ [req.params.flagId]: flag })
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
