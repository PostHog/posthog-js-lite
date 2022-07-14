import { PostHogStorage } from 'posthog-core'

// Methods partially borrowed from quirksmode.org/js/cookies.html
export const cookieStore: PostHogStorage = {
  getItem(key) {
    try {
      let nameEQ = key + '='
      let ca = document.cookie.split(';')
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') {
          c = c.substring(1, c.length)
        }
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length, c.length))
        }
      }
    } catch (err) {}
    return null
  },

  setItem(key: string, value: string) {
    try {
      let cdomain = '',
        expires = '',
        secure = ''

      const new_cookie_val =
        key + '=' + encodeURIComponent(JSON.stringify(value)) + expires + '; path=/' + cdomain + secure
      document.cookie = new_cookie_val
    } catch (err) {
      return
    }
  },

  removeItem(name) {
    try {
      cookieStore.setItem(name, '')
    } catch (err) {
      return
    }
  },
  clear() {
    document.cookie = ''
  },
  getAllKeys() {
    let ca = document.cookie.split(';')
    let keys = []

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) == ' ') {
        c = c.substring(1, c.length)
      }
      keys.push(c.split('=')[0])
    }

    return keys
  },
}

const createStorageLike = (store: any): PostHogStorage => {
  return {
    getItem(key) {
      return window.localStorage.getItem(key)
    },

    setItem(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value))
    },

    removeItem(key) {
      window.localStorage.removeItem(key)
    },
    clear() {
      window.localStorage.clear()
    },
    getAllKeys() {
      const keys = []
      for (let key in localStorage) {
        keys.push(key)
      }
      return keys
    },
  }
}

export const _localStore = createStorageLike(window.localStorage)
export const _sessionStore = createStorageLike(window.sessionStorage)

const checkStoreIsSupported = (storage: PostHogStorage, key = '__mplssupport__'): boolean => {
  if (!window) {
    return false
  }
  try {
    let val = 'xyz'
    storage.setItem(key, val)
    if (storage.getItem(key) !== val) {
      return false
    }
    storage.removeItem(key)
    return true
  } catch (err) {
    return false
  }
}

export const localStore = checkStoreIsSupported(_localStore) ? _localStore : undefined
export const sessionStorage = checkStoreIsSupported(_sessionStore) ? _sessionStore : undefined
