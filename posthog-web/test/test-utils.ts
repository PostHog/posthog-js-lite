
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any
import { JSDOM } from 'jsdom'

export const setupDom = () => {
    global.window = (new JSDOM()).window as any;
}
    