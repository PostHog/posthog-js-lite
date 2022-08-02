import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { LZString } from 'posthog-core'
const PORT = process.env.PORT || 8000

export interface MockRequest {
  method: string
  path: string
  headers: any
  body: any
  params: any
}

export const createMockServer = (): [any, jest.Mock<MockRequest, any>] => {
  let app = express()
  app.use(bodyParser.urlencoded())

  let httpMock = jest.fn()

  const handleRequest = (req: Request, res: Response) => {
    let body
    try {
      body = req.body.compression === 'lz64' ? JSON.parse(LZString.decompressFromBase64(req.body.data) || '') : req.body
    } catch (e) {
      console.error(e)
      body = 'error'
    }
    const data: MockRequest = {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: body,
      params: req.params,
    }
    res.json(httpMock(data) || { status: 'ok' })
  }

  app.get('*', handleRequest)
  app.post('*', handleRequest)

  let server = app.listen(PORT)
  console.log(`Mock PostHog server listening at ${PORT}`)

  return [server, httpMock]
}
