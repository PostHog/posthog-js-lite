import { PostHogNextConfigComplete } from './config'
import { exec } from 'child_process'

export class SourcemapWebpackPlugin {
  constructor(private posthogOptions: PostHogNextConfigComplete, private isServer: boolean) {}

  apply(compiler: any): void {
    const directory = this.isServer ? `./.next/server` : `./.next/static/chunks`
    async function onDone(_: any, callback: any): Promise<void> {
      callback = callback || (() => {})
      await new Promise<void>((resolve, reject) => {
        exec(`posthog-cli sourcemap inject --directory ${directory}`, (error, stdout, stderr) => {
          if (error) {
            reject(error)
            return
          }
          if (stderr) {
            console.error('Error:', stderr)
          }
          console.log('Output:', stdout)
          resolve()
        })
      })
      callback()
    }

    if (compiler.hooks) {
      compiler.hooks.done.tapAsync('SourcemapWebpackPlugin', onDone)
    } else {
      compiler.plugin('done', onDone)
    }
  }
}
