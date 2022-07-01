export type PostHogCoreFetchRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  url: string
  data: any
  headers: {
    [key: string]: string
  }
  timeout?: number
}

export type PostHogCoreFetchResponse = {
  status: number
  data: any
}

export type PostHogFetchOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  mode?: 'no-cors'
  credentials?: 'omit'
  headers: { [key: string]: string }
  body: string
}
