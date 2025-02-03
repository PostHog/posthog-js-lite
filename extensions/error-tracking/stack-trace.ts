// copied and adapted from https://github.com/getsentry/sentry-javascript/blob/41fef4b10f3a644179b77985f00f8696c908539f/packages/browser/src/stack-parsers.ts
// 💖open source

import { posix, sep, dirname } from 'node:path'
import { StackFrame, StackLineParser, StackLineParserFn, StackParser } from './types'

type GetModuleFn = (filename: string | undefined) => string | undefined

// This was originally forked from https://github.com/csnover/TraceKit, and was largely
// re-written as part of raven - js.
//
// This code was later copied to the JavaScript mono - repo and further modified and
// refactored over the years.

// Copyright (c) 2013 Onur Can Cakmak onur.cakmak@gmail.com and all TraceKit contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files(the 'Software'), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and / or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be included in all copies
// or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
// CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
// OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/
const STACKTRACE_FRAME_LIMIT = 50

const UNKNOWN_FUNCTION = '?'

// function createFrame(filename: string, func: string, lineno?: number, colno?: number): StackFrame {
//   const frame: StackFrame = {
//     platform: 'node:javascript',
//     filename,
//     function: func === '<anonymous>' ? UNKNOWN_FUNCTION : func,
//     in_app: true, // All browser frames are considered in_app
//   }

//   if (lineno !== undefined) {
//     frame.lineno = lineno
//   }

//   if (colno !== undefined) {
//     frame.colno = colno
//   }

//   return frame
// }

/** Node Stack line parser */
export function node(getModule?: GetModuleFn): StackLineParserFn {
  const FILENAME_MATCH = /^\s*[-]{4,}$/
  const FULL_MATCH = /at (?:async )?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/

  return (line: string) => {
    const lineMatch = line.match(FULL_MATCH)

    if (lineMatch) {
      let object: string | undefined
      let method: string | undefined
      let functionName: string | undefined
      let typeName: string | undefined
      let methodName: string | undefined

      if (lineMatch[1]) {
        functionName = lineMatch[1]

        let methodStart = functionName.lastIndexOf('.')
        if (functionName[methodStart - 1] === '.') {
          methodStart--
        }

        if (methodStart > 0) {
          object = functionName.slice(0, methodStart)
          method = functionName.slice(methodStart + 1)
          const objectEnd = object.indexOf('.Module')
          if (objectEnd > 0) {
            functionName = functionName.slice(objectEnd + 1)
            object = object.slice(0, objectEnd)
          }
        }
        typeName = undefined
      }

      if (method) {
        typeName = object
        methodName = method
      }

      if (method === '<anonymous>') {
        methodName = undefined
        functionName = undefined
      }

      if (functionName === undefined) {
        methodName = methodName || UNKNOWN_FUNCTION
        functionName = typeName ? `${typeName}.${methodName}` : methodName
      }

      let filename = lineMatch[2]?.startsWith('file://') ? lineMatch[2].slice(7) : lineMatch[2]
      const isNative = lineMatch[5] === 'native'

      // If it's a Windows path, trim the leading slash so that `/C:/foo` becomes `C:/foo`
      if (filename?.match(/\/[A-Z]:/)) {
        filename = filename.slice(1)
      }

      if (!filename && lineMatch[5] && !isNative) {
        filename = lineMatch[5]
      }

      return {
        filename: filename ? decodeURI(filename) : undefined,
        module: getModule ? getModule(filename) : undefined,
        function: functionName,
        lineno: _parseIntOrUndefined(lineMatch[3]),
        colno: _parseIntOrUndefined(lineMatch[4]),
        in_app: filenameIsInApp(filename || '', isNative),
        platform: 'node:javascript',
      }
    }

    if (line.match(FILENAME_MATCH)) {
      return {
        filename: line,
        platform: 'node:javascript',
      }
    }

    return undefined
  }
}

/**
 * Does this filename look like it's part of the app code?
 */
export function filenameIsInApp(filename: string, isNative: boolean = false): boolean {
  const isInternal =
    isNative ||
    (filename &&
      // It's not internal if it's an absolute linux path
      !filename.startsWith('/') &&
      // It's not internal if it's an absolute windows path
      !filename.match(/^[A-Z]:/) &&
      // It's not internal if the path is starting with a dot
      !filename.startsWith('.') &&
      // It's not internal if the frame has a protocol. In node, this is usually the case if the file got pre-processed with a bundler like webpack
      !filename.match(/^[a-zA-Z]([a-zA-Z0-9.\-+])*:\/\//)) // Schema from: https://stackoverflow.com/a/3641782

  // in_app is all that's not an internal Node function or a module within node_modules
  // note that isNative appears to return true even for node core libraries
  // see https://github.com/getsentry/raven-node/issues/176

  return !isInternal && filename !== undefined && !filename.includes('node_modules/')
}

function _parseIntOrUndefined(input: string | undefined): number | undefined {
  return parseInt(input || '', 10) || undefined
}

export function nodeStackLineParser(getModule?: GetModuleFn): StackLineParser {
  return [90, node(getModule)]
}

export const defaultStackParser: StackParser = createStackParser(nodeStackLineParser(createGetModuleFromFilename()))

export function createStackParser(...parsers: StackLineParser[]): StackParser {
  const sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map((p) => p[1])

  return (stack: string, skipFirstLines: number = 0): StackFrame[] => {
    const frames: StackFrame[] = []
    const lines = stack.split('\n')

    for (let i = skipFirstLines; i < lines.length; i++) {
      const line = lines[i] as string
      // Ignore lines over 1kb as they are unlikely to be stack frames.
      // Many of the regular expressions use backtracking which results in run time that increases exponentially with
      // input size. Huge strings can result in hangs/Denial of Service:
      // https://github.com/getsentry/sentry-javascript/issues/2286
      if (line.length > 1024) {
        continue
      }

      // https://github.com/getsentry/sentry-javascript/issues/5459
      // Remove webpack (error: *) wrappers
      const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, '$1') : line

      // https://github.com/getsentry/sentry-javascript/issues/7813
      // Skip Error: lines
      if (cleanedLine.match(/\S*Error: /)) {
        continue
      }

      for (const parser of sortedParsers) {
        const frame = parser(cleanedLine)

        if (frame) {
          frames.push(frame)
          break
        }
      }

      if (frames.length >= STACKTRACE_FRAME_LIMIT) {
        break
      }
    }

    return reverseAndStripFrames(frames)
  }
}

export function reverseAndStripFrames(stack: ReadonlyArray<StackFrame>): StackFrame[] {
  if (!stack.length) {
    return []
  }

  const localStack = Array.from(stack)

  localStack.reverse()

  return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
    ...frame,
    filename: frame.filename || getLastStackFrame(localStack).filename,
    function: frame.function || UNKNOWN_FUNCTION,
  }))
}

function getLastStackFrame(arr: StackFrame[]): StackFrame {
  return arr[arr.length - 1] || {}
}

/** Creates a function that gets the module name from a filename */
export function createGetModuleFromFilename(
  basePath: string = process.argv[1] ? dirname(process.argv[1]) : process.cwd(),
  isWindows: boolean = sep === '\\'
): (filename: string | undefined) => string | undefined {
  const normalizedBase = isWindows ? normalizeWindowsPath(basePath) : basePath

  return (filename: string | undefined) => {
    if (!filename) {
      return
    }

    const normalizedFilename = isWindows ? normalizeWindowsPath(filename) : filename

    // eslint-disable-next-line prefer-const
    let { dir, base: file, ext } = posix.parse(normalizedFilename)

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      file = file.slice(0, ext.length * -1)
    }

    // The file name might be URI-encoded which we want to decode to
    // the original file name.
    const decodedFile = decodeURIComponent(file)

    if (!dir) {
      // No dirname whatsoever
      dir = '.'
    }

    const n = dir.lastIndexOf('/node_modules')
    if (n > -1) {
      return `${dir.slice(n + 14).replace(/\//g, '.')}:${decodedFile}`
    }

    // Let's see if it's a part of the main module
    // To be a part of main module, it has to share the same base
    if (dir.startsWith(normalizedBase)) {
      const moduleName = dir.slice(normalizedBase.length + 1).replace(/\//g, '.')
      return moduleName ? `${moduleName}:${decodedFile}` : decodedFile
    }

    return decodedFile
  }
}

/** normalizes Windows paths */
function normalizeWindowsPath(path: string): string {
  return path
    .replace(/^[A-Z]:/, '') // remove Windows-style prefix
    .replace(/\\/g, '/') // replace all `\` instances with `/`
}
