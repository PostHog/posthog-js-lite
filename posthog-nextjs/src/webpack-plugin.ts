import { PostHogNextConfigComplete } from './config'
import { rimraf } from 'rimraf'
import util from 'util'
import { exec } from 'child_process'

const execPromise = util.promisify(exec)

type NextRuntime = 'edge' | 'nodejs' | undefined

export class SourcemapWebpackPlugin {
  directory: string

  constructor(
    private posthogOptions: PostHogNextConfigComplete,
    private isServer: boolean,
    private nextRuntime: NextRuntime
  ) {
    this.directory = this.isServer ? `./.next/server` : `./.next/static/chunks`
  }

  apply(compiler: any): void {
    if (this.nextRuntime === 'edge') {
      // TODO: edge and nodejs runtime output files in the same location
      // to support edge runtime we need a way to pass a list of files to the cli
      return
    }

    const onDone = async (_: any, callback: any): Promise<void> => {
      callback = callback || (() => {})
      await this.runInject()
      await this.runUpload()
      if (this.posthogOptions.sourcemaps.deleteAfterUpload) {
        await this.runDelete()
      }
      callback()
    }

    if (compiler.hooks) {
      compiler.hooks.done.tapAsync('SourcemapWebpackPlugin', onDone)
    } else {
      compiler.plugin('done', onDone)
    }
  }

  async runInject(): Promise<void> {
    await execPromise(`npx posthog-cli sourcemap inject --directory ${this.directory}`)
  }

  async runUpload(): Promise<void> {
    const sourcemapOptions = ['--directory', this.directory]
    if (this.posthogOptions.sourcemaps.project) {
      sourcemapOptions.push('--project', this.posthogOptions.sourcemaps.project)
    }
    const cliOptions = []
    if (this.posthogOptions.host) {
      cliOptions.push('--host', this.posthogOptions.host)
    }
    // Add env variables
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      POSTHOG_CLI_TOKEN: this.posthogOptions.authToken,
      POSTHOG_CLI_ENV_ID: this.posthogOptions.envId,
    }
    await execPromise(`npx posthog-cli ${cliOptions} sourcemap upload ${sourcemapOptions}`, { env: envVars })
  }

  async runDelete(): Promise<void> {
    await rimraf(`${this.directory}/**/*.map`, { glob: true })
  }
}
