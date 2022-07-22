export class SimpleEventEmitter {
  events: { [key: string]: ((e: any) => void)[] } = {}

  constructor() {
    this.events = {}
  }

  on(event: string, listener: (e: any) => void): () => void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)

    return () => {
      this.events[event] = this.events[event].filter((x) => x !== listener)
    }
  }

  emit(event: string, payload: any): void {
    if (!this.events[event]) {
      return
    }
    for (const listener of this.events[event]) {
      listener(payload)
    }
  }
}
