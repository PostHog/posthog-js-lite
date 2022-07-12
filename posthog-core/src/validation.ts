import { assert } from './utils'

// PostHog messages can be a maximum of 32 kB.
const MAX_SIZE = 32 << 10

const typeOf = (x: any) => typeof x
/**
 * Validate an event.
 */

export function eventValidation(type: string, event: any) {
  validateGenericEvent(event)
  assert(type, 'You must pass an event type.')
  switch (type) {
    case 'capture':
      return validateCaptureEvent(event)
    case 'identify':
      return validateIdentifyEvent(event)
    case 'alias':
      return validateAliasEvent(event)
    case 'groupIdentify':
      return validateGroupIdentifyEvent(event)
    case 'isFeatureEnabled':
      return validateIsFeatureEnabled(event)
    default:
      assert(0, `Invalid event type: ${type}`)
  }
}

/**
 * Validate a "capture" event.
 */

function validateCaptureEvent(event: any) {
  assert(event.distinctId, 'You must pass a "distinctId".')
  assert(event.event, 'You must pass an "event".')
}

/**
 * Validate a "identify" event.
 */

function validateIdentifyEvent(event: any) {
  assert(event.distinctId, 'You must pass a "distinctId".')
}

/**
 * Validate an "alias" event.
 */

function validateAliasEvent(event: any) {
  assert(event.distinctId, 'You must pass a "distinctId".')
  assert(event.alias, 'You must pass a "alias".')
}

/**
 * Validate an "groupIdentify" event.
 */

function validateGroupIdentifyEvent(event: any) {
  assert(event.groupType, 'You must pass a "groupType".')
  assert(event.groupKey, 'You must pass a "groupKey".')
}

/**
 * Validate a "isFeatureEnabled" call
 */

function validateIsFeatureEnabled(event: any) {
  assert(event.key, 'You must pass a "key".')
  assert(event.distinctId, 'You must pass a "distinctId".')
  assert(typeOf(event.defaultResult) === 'boolean', '"defaultResult" must be a boolean.')
  if (event.groups) {
    assert(typeOf(event.groups) === 'object', 'You must pass an object for "groups".')
  }
}

/**
 * Validation rules.
 */

const genericValidationRules: { [key: string]: string } = {
  event: 'string',
  properties: 'object',
  alias: 'string',
  timestamp: 'date',
  distinctId: 'string',
  type: 'string',
}

/**
 * Validate an event object.
 */

export function validateGenericEvent(event: any) {
  assert(typeOf(event) === 'object', 'You must pass a message object.: any')
  const jsonString = JSON.stringify(event)
  // Strings are variable byte encoded, so json.length is not sufficient.
  assert(jsonString.length < MAX_SIZE, 'Your message must be < 32 kB.')

  // TODO: Check this out...
  for (let key in genericValidationRules) {
    const val = event[key]
    if (!val) continue
    const expectedType = genericValidationRules[key]
    const a = expectedType === 'object' ? 'an' : 'a'
    const message = `${key} must be ${a}  ${expectedType}.`
    assert(typeOf(val) === expectedType, message)
  }
}
