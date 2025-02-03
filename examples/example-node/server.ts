import express from 'express'
import { PostHog, sentryIntegration, PostHogSentryIntegration, setupExpressErrorHandler } from 'posthog-node'
import undici from 'undici'

import * as Sentry from '@sentry/node'

const app = express()

const {
  PH_API_KEY = 'phc_oNgsfA22FuAyUDLFmVvS7SWeBrZ6RPHbtl9QJIEobZJ',
  PH_HOST = 'http://127.0.0.1:8000',
  PH_PERSONAL_API_KEY = 'phx_MtSzPxseihPi9Ftnsc2vqpfZgi4XAquWefA8iJg03nnUi2u',
} = process.env

const posthog = new PostHog(PH_API_KEY, {
  host: PH_HOST,
  flushAt: 10,
  personalApiKey: PH_PERSONAL_API_KEY,
  // enableExceptionAutocapture: true,
  // By default PostHog uses axios for fetch but you can specify your own implementation if preferred
  fetch(url, options) {
    console.log(url, options)
    return undici.fetch(url, options)
  },
})

posthog.debug()

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  integrations: [sentryIntegration(posthog)],
  debug: true,
})

app.get('/', (req, res) => {
  posthog.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'legacy capture' })
  res.send({ hello: 'world' })
})

app.get('/unhandled-error', () => {
  throw new Error('unhandled error')
})

app.get('/error', (req, res) => {
  const error = new Error('example error')
  Sentry.captureException(error, {
    tags: {
      [PostHogSentryIntegration.POSTHOG_ID_TAG]: 'EXAMPLE_APP_GLOBAL',
    },
  })
  posthog.captureException(error, 'EXAMPLE_APP_GLOBAL')
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

Sentry.setupExpressErrorHandler(app)
setupExpressErrorHandler(posthog, app)

const server = app.listen(8020, () => {
  console.log('⚡: Server is running at http://localhost:8020')
})

async function handleExit(signal: any) {
  console.log(`Received ${signal}. Flushing...`)
  await posthog.shutdown()
  console.log(`Flush complete`)
  server.close(() => {
    process.exit(0)
  })
}
process.on('SIGINT', handleExit)
process.on('SIGQUIT', handleExit)
process.on('SIGTERM', handleExit)
