// See: https://rollupjs.org

import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import path from 'path'

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    inlineDynamicImports: true,
    sourcemap: true
  },
  // Catch-all context override for the entire GitHub Actions ecosystem
  moduleContext: (id) => {
    const normalizedId = id.split(path.sep).join('/')
    if (normalizedId.includes('@actions/')) {
      return 'this'
    }
  },
  plugins: [
    typescript(),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    json()
  ]
}

export default config
