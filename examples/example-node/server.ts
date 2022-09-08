import express from 'express'
import { PostHog } from 'posthog-node'
import undici from 'undici'

const app = express()

const posthog = new PostHog('phc_sRe6hMjzNFoFM3FQFh4GkTeMiWr1V9oy5CxBgF2vbO2', {
  host: 'http://localhost:8000',
  flushAt: 10,
  // By default PostHog uses node-fetch but you can specify your own implementation if preferred
  fetch(url, options) {
      return undici.fetch(url, options)
  },
})

posthog.debug()

app.get('/', (req, res) => {
  posthog.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'legacy capture' })
  res.send({ hello: 'world' })
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
