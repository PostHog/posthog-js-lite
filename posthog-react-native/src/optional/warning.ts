export const warn = (name: string): void => {
  console.warn(`PostHog: Missing ${name} optional dependency. Some functions may not work as expected...`)
}
