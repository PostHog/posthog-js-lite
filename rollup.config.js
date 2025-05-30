import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import typescript from 'rollup-plugin-typescript2'
import dts from 'rollup-plugin-dts'

import pkg from './package.json'

const extensions = ['.js', '.jsx', '.ts', '.tsx']

const plugins = (x) => [
  // Allows node_modules resolution
  resolve({ extensions }),
  // Allow bundling cjs modules. Rollup doesn`t understand cjs
  commonjs(),
  json(),
  // Compile TypeScript/JavaScript files
  typescript({
    include: [`*.(t|j)s+(|x)`, `**/*.(t|j)s+(|x)`],
    tsconfig: `./${x}/tsconfig.json`,
    sourceMap: true,
  }),
  babel({
    extensions,
    babelHelpers: 'bundled',
    include: [`${x}/src/**/*`],
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
      '@babel/preset-react',
    ],
  }),
]

let globalExternal = []
  .concat(Object.keys(pkg.dependencies || {}))
  .concat(Object.keys(pkg.peerDependencies || {}))
  .concat(Object.keys(pkg.devDependencies || {}))

function external(localPackagePath) {
  const localPkg = require(localPackagePath)
  let external = [...globalExternal]
    .concat(Object.keys(localPkg.dependencies || {}))
    .concat(Object.keys(localPkg.peerDependencies || {}))
    .concat(Object.keys(localPkg.devDependencies || {}))
  return external
}

const configs = []

// posthog-node //

const runtimes = ['node', 'edge']

runtimes.forEach((runtime) => {
  configs.push({
    input: `./posthog-node/src/entrypoints/index.${runtime}.ts`,
    output: [
      {
        file: `./posthog-node/lib/${runtime}/index.cjs`,
        sourcemap: true,
        exports: 'named',
        format: 'cjs',
      },
      {
        file: `./posthog-node/lib/${runtime}/index.mjs`,
        sourcemap: true,
        format: 'es',
      },
    ],
    external: external(`./posthog-node/package.json`),
    plugins: plugins('posthog-node'),
  })
})

// We only build types from node as all types should be the same
configs.push({
  input: `./posthog-node/src/entrypoints/index.node.ts`,
  output: [{ file: `./posthog-node/lib/index.d.ts`, format: 'es' }],
  external: external('./posthog-node/package.json'),
  plugins: [resolve({ extensions }), dts({ tsconfig: './posthog-node/tsconfig.json' })],
})

// posthog-ai //
// posthog-web //

const packages = ['posthog-web', 'posthog-ai']

packages.forEach((x) => {
  const localPkg = require(`./${x}/package.json`)

  configs.push({
    input: `./${x}/index.ts`,
    output: [
      {
        file: `./${x}/` + localPkg.main,
        sourcemap: true,
        exports: 'named',
        format: `cjs`,
      },
      {
        file: `./${x}/` + localPkg.module,
        sourcemap: true,
        format: `es`,
      },
    ],
    external: external(`./${x}/package.json`),
    plugins: plugins(x),
  })

  configs.push({
    input: `./${x}/index.ts`,
    output: [{ file: `./${x}/lib/index.d.ts`, format: 'es' }],
    external: external(`./${x}/package.json`),
    plugins: [resolve({ extensions }), dts({ tsconfig: `./${x}/tsconfig.json` })],
  })
})

// posthog-ai //

// Add submodule builds for posthog-ai
const providers = ['anthropic', 'openai', 'vercel', 'langchain']

providers.forEach((provider) => {
  configs.push({
    input: `./posthog-ai/src/${provider}/index.ts`,
    output: [
      {
        file: `./posthog-ai/lib/${provider}/index.cjs`,
        sourcemap: true,
        exports: 'named',
        format: 'cjs',
      },
      {
        file: `./posthog-ai/lib/${provider}/index.mjs`,
        sourcemap: true,
        format: 'es',
      },
    ],
    external: external('./posthog-ai/package.json'),
    plugins: [
      resolve({ extensions }),
      commonjs(),
      json(),
      babel({
        extensions,
        babelHelpers: 'bundled',
        include: ['posthog-ai/src/**/*.{js,jsx,ts,tsx}'],
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
          '@babel/preset-react',
        ],
      }),
    ],
  })

  configs.push({
    input: `./posthog-ai/src/${provider}/index.ts`,
    output: [{ file: `./posthog-ai/lib/${provider}/index.d.ts`, format: 'es' }],
    external: external('./posthog-ai/package.json'),
    plugins: [resolve({ extensions }), dts({ tsconfig: './posthog-ai/tsconfig.json' })],
  })
})

// posthog nextjs
configs.push(
  {
    input: './posthog-nextjs/src/index.ts',
    output: [
      {
        file: './posthog-nextjs/lib/index.js',
        format: 'esm',
      },
    ],
    external: external('./posthog-nextjs/package.json'),
    plugins: plugins('posthog-nextjs'),
  },
  {
    input: `./posthog-nextjs/src/index.ts`,
    output: [{ file: `./posthog-nextjs/lib/index.d.ts`, format: 'es' }],
    external: external('./posthog-nextjs/package.json'),
    plugins: [resolve({ extensions }), dts({ tsconfig: './posthog-nextjs/tsconfig.json' })],
  }
)

export default configs
