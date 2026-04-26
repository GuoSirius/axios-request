import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default [
  // ESM 和 CJS 打包
  {
    input: 'src/index.ts',
    output: [
      // CommonJS
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      // ES Module
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
        exports: 'named',
      },
      // UMD (需要 name)
      {
        file: pkg.umd,
        format: 'umd',
        name: pkg.umdName,
        sourcemap: true,
        exports: 'named',
        globals: {
          axios: 'axios',
        },
      },
      // UMD 压缩版
      {
        file: pkg.umd.replace('.js', '.min.js'),
        format: 'umd',
        name: pkg.umdName,
        sourcemap: true,
        exports: 'named',
        globals: {
          axios: 'axios',
        },
        plugins: [terser()],
      },
    ],
    external: ['axios'],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
  // 生成类型声明
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'es',
    },
    plugins: [dts()],
  },
];
