import express from 'express'
import { PostHogNodejsGlobal } from 'posthog-node'

const app = express()

const posthog = new PostHogNodejsGlobal('phc_FzKQvNvps9ZUTxF5KJR9jIKdGb4bq4HNBa9SRyAHi0C', {
  host: 'http://localhost:8000',
})

app.get('/', (req, res) => {
  posthog.user('EXAMPLE_APP_GLOBAL').capture('home page loaded')
  res.send({ hello: 'world' })
})

app.get('/user/:userId/action', (req, res) => {
  res.send({ status: 'ok' })
  posthog.user(req.params.userId).capture('user did action', req.params)
})

app.listen(8010, () => {
  console.log('⚡: Server is running at http://localhost:8010')
})

process.on('exit', () => {
  console.log('exiting')
})
