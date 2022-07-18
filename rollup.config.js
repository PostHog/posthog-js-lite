import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'
import dts from 'rollup-plugin-dts'

import pkg from './package.json'

const extensions = ['.js', '.jsx', '.ts', '.tsx']

let globalExternal = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {}))

const configs = ['posthog-react-native', 'posthog-node', 'posthog-web'].reduce((acc, x) => {
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
          format: `cjs`,
        },
        {
          file: `./${x}/` + localPkg.module,
          format: `es`,
        },
      ],
      external,
      plugins: [
        // Allows node_modules resolution
        resolve({ extensions }),
        // Allow bundling cjs modules. Rollup doesn`t understand cjs
        commonjs(),
        // Compile TypeScript/JavaScript files
        typescript({
          include: [`*.(t|j)s+(|x)`, `**/*.(t|j)s+(|x)`],
          tsconfig: `./${x}/tsconfig.json`,
        }),
        babel({
          extensions,
          babelHelpers: `bundled`,
          include: [`${x}/src/**/*`],
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            '@babel/preset-typescript',
            '@babel/preset-react',
          ],
        }),
      ],
    },
    {
      input: `./${x}/./lib/${x}/index.d.ts`,
      output: [{ file: `./${x}/lib/index.d.ts`, format: 'es' }],
      plugins: [dts()],
    },
  ]
}, [])

export default configs
