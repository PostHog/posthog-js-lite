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

let globalExternal = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {}))

const configs = ['posthog-web', 'posthog-ai'].reduce((acc, x) => {
  const localPkg = require(`./${x}/package.json`)
  let external = [...globalExternal]
    .concat(Object.keys(localPkg.dependencies || {}))
    .concat(Object.keys(localPkg.peerDependencies || {}))
    .concat(Object.keys(localPkg.devDependencies || {}))

  return [
    ...acc,
    {
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
      external,
      plugins: plugins(x),
    },
    {
      input: `./${x}/lib/${x}/index.d.ts`,
      output: [{ file: `./${x}/lib/index.d.ts`, format: 'es' }],
      plugins: [dts()],
    },
  ]
}, [])

// posthog-node //

const nodePkg = require('./posthog-node/package.json')
const nodeExternal = [...globalExternal]
  .concat(Object.keys(nodePkg.dependencies || {}))
  .concat(Object.keys(nodePkg.peerDependencies || {}))
  .concat(Object.keys(nodePkg.devDependencies || {}))

const runtimes = ['node', 'edge']

runtimes.forEach((runtime) => {
  configs.push({
    input: `./posthog-node/src/entrypoints/index.${runtime}.ts`,
    output: [
      {
        file: `./posthog-node/lib/${runtime}/index.cjs.js`,
        sourcemap: true,
        exports: 'named',
        format: 'cjs',
      },
      {
        file: `./posthog-node/lib/${runtime}/index.esm.js`,
        sourcemap: true,
        format: 'es',
      },
    ],
    external: nodeExternal,
    plugins: plugins('posthog-node'),
  })
})

// We only build types from node as all types should be the same
configs.push({
  input: `./posthog-node/src/entrypoints/index.node.ts`,
  output: [{ file: `./posthog-node/lib/index.d.ts`, format: 'es' }],
  plugins: [dts({ tsconfig: './posthog-node/tsconfig.json' })],
})

// posthog-ai //

// Add submodule builds for posthog-ai
const aiPkg = require('./posthog-ai/package.json')
const aiExternal = [...globalExternal]
  .concat(Object.keys(aiPkg.dependencies || {}))
  .concat(Object.keys(aiPkg.peerDependencies || {}))
  .concat(Object.keys(aiPkg.devDependencies || {}))

const providers = ['anthropic', 'openai', 'vercel', 'langchain']

providers.forEach((provider) => {
  configs.push({
    input: `./posthog-ai/src/${provider}/index.ts`,
    output: [
      {
        file: `./posthog-ai/lib/${provider}/index.cjs.js`,
        sourcemap: true,
        exports: 'named',
        format: 'cjs',
      },
      {
        file: `./posthog-ai/lib/${provider}/index.esm.js`,
        sourcemap: true,
        format: 'es',
      },
    ],
    external: aiExternal,
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
    plugins: [dts({ tsconfig: './posthog-ai/tsconfig.json' })],
  })
})

export default configs
