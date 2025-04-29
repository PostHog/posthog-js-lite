// Standard local evaluation rate limit is 600 per minute (10 per second),
// so the fastest a poller should ever be set is 100ms.
export const MINIMUM_POLLING_INTERVAL = 100
export const THIRTY_SECONDS = 30 * 1000
