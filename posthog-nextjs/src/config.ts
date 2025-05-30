import type { NextConfig } from 'next'
import { SourcemapWebpackPlugin } from './webpack-plugin'

type NextFuncConfig = (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => NextConfig
type NextAsyncConfig = (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => Promise<NextConfig>
type UserProvidedConfig = NextConfig | NextFuncConfig | NextAsyncConfig

export type LogLevel = 'silent' | 'info' | 'debug' | 'warning' | 'error'
export type PostHogNextConfig = {
  apiKey: string
  host?: string
  logLevel?: LogLevel
  sourcemaps?: {
    enabled?: boolean
    project?: string
    version?: string
    deleteAfterUpload?: boolean
  }
}

export type PostHogNextConfigComplete = {
  apiKey: string
  host: string
  logLevel: LogLevel
  sourcemaps: {
    enabled: boolean
    project?: string
    version?: string
    deleteAfterUpload: boolean
  }
}

export function withPostHogConfig(userNextConfig: UserProvidedConfig, posthogConfig: PostHogNextConfig): NextConfig {
  const posthogNextConfigComplete = resolvePostHogConfig(posthogConfig)
  return async (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => {
    const { webpack: userWebPackConfig, ...userConfig } = await resolveUserConfig(userNextConfig, phase, defaultConfig)
    const defaultWebpackConfig = userWebPackConfig || ((config: any) => config)
    return {
      ...userConfig,
      productionBrowserSourceMaps: posthogNextConfigComplete.sourcemaps.enabled,
      webpack: (config: any, options: any) => {
        console.log(phase, options.buildId, options.dev, options.isServer, options.nextRuntime)
        const webpackConfig = defaultWebpackConfig(config, options)
        if (webpackConfig && options.isServer && posthogNextConfigComplete.sourcemaps.enabled) {
          webpackConfig.devtool = 'source-map'
        }
        if (posthogNextConfigComplete.sourcemaps.enabled) {
          webpackConfig.plugins = webpackConfig.plugins || []
          webpackConfig.plugins.push(new SourcemapWebpackPlugin(posthogNextConfigComplete, options.isServer))
        }
        return webpackConfig
      },
    }
  }
}

function resolveUserConfig(
  userNextConfig: UserProvidedConfig,
  phase: string,
  defaultConfig: NextConfig
): Promise<NextConfig> {
  if (typeof userNextConfig === 'function') {
    const maybePromise = userNextConfig(phase, { defaultConfig })
    if (maybePromise instanceof Promise) {
      return maybePromise
    } else {
      return Promise.resolve(maybePromise)
    }
  } else if (typeof userNextConfig === 'object') {
    return Promise.resolve(userNextConfig)
  } else {
    throw new Error('Invalid user config')
  }
}

function resolvePostHogConfig(posthogProvidedConfig: PostHogNextConfig): PostHogNextConfigComplete {
  const { apiKey, host, logLevel, sourcemaps = {} } = posthogProvidedConfig
  return {
    apiKey,
    host: host ?? 'https://us.posthog.com',
    logLevel: logLevel ?? 'error',
    sourcemaps: {
      enabled: sourcemaps.enabled ?? process.env.NODE_ENV == 'production',
      deleteAfterUpload: sourcemaps.deleteAfterUpload ?? true,
    },
  }
}
