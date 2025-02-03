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
