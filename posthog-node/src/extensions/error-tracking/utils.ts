const nativeIsArray = Array.isArray
const ObjProto = Object.prototype
export const hasOwnProperty = ObjProto.hasOwnProperty
const toString = ObjProto.toString

export const isArray =
  nativeIsArray ||
  function (obj: any): obj is any[] {
    return toString.call(obj) === '[object Array]'
  }

// from a comment on http://dbj.org/dbj/?p=286
// fails on only one very rare and deliberate custom object:
// let bomb = { toString : undefined, valueOf: function(o) { return "function BOMBA!"; }};
export const isFunction = (x: unknown): x is (...args: any[]) => any => {
  return typeof x === 'function'
}

export const isNativeFunction = (x: unknown): x is (...args: any[]) => any =>
  isFunction(x) && x.toString().indexOf('[native code]') !== -1

// Underscore Addons
export const isObject = (x: unknown): x is Record<string, any> => {
  return x === Object(x) && !isArray(x)
}
export const isEmptyObject = (x: unknown): boolean => {
  if (isObject(x)) {
    for (const key in x) {
      if (hasOwnProperty.call(x, key)) {
        return false
      }
    }
    return true
  }
  return false
}
export const isUndefined = (x: unknown): x is undefined => x === void 0

export const isString = (x: unknown): x is string => {
  return toString.call(x) === '[object String]'
}

export const isEmptyString = (x: unknown): boolean => isString(x) && x.trim().length === 0

export const isNull = (x: unknown): x is null => {
  return x === null
}

/*
    sometimes you want to check if something is null or undefined
    that's what this is for
 */
export const isNullish = (x: unknown): x is null | undefined => isUndefined(x) || isNull(x)

export const isNumber = (x: unknown): x is number => {
  return toString.call(x) === '[object Number]'
}
export const isBoolean = (x: unknown): x is boolean => {
  return toString.call(x) === '[object Boolean]'
}

/** A simple Least Recently Used map */
export class LRUMap<K, V> {
  private readonly _cache: Map<K, V>

  public constructor(private readonly _maxSize: number) {
    this._cache = new Map<K, V>()
  }

  /** Get the current size of the cache */
  public get size(): number {
    return this._cache.size
  }

  /** Get an entry or undefined if it was not in the cache. Re-inserts to update the recently used order */
  public get(key: K): V | undefined {
    const value = this._cache.get(key)
    if (value === undefined) {
      return undefined
    }
    // Remove and re-insert to update the order
    this._cache.delete(key)
    this._cache.set(key, value)
    return value
  }

  /** Insert an entry and evict an older entry if we've reached maxSize */
  public set(key: K, value: V): void {
    if (this._cache.size >= this._maxSize) {
      const value = this._cache.keys().next().value
      if (value) {
        // keys() returns an iterator in insertion order so keys().next() gives us the oldest key
        this._cache.delete(value)
      }
    }
    this._cache.set(key, value)
  }

  /** Remove an entry and return the entry if it was in the cache */
  public remove(key: K): V | undefined {
    const value = this._cache.get(key)
    if (value) {
      this._cache.delete(key)
    }
    return value
  }

  /** Clear all entries */
  public clear(): void {
    this._cache.clear()
  }

  /** Get all the keys */
  public keys(): Array<K> {
    return Array.from(this._cache.keys())
  }

  /** Get all the values */
  public values(): Array<V> {
    const values: V[] = []
    this._cache.forEach((value) => values.push(value))
    return values
  }
}
