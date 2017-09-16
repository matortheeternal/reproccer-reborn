import copy from 'rollup-plugin-copy';
import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';
import pug from 'rollup-plugin-pug-html';

export default [
  {
    input: 'src/index.js',
    external: ['ngapp', 'info', 'xelib'],
    plugins: [
      eslint(),
      pug({ include: 'src/**/*.pug', pretty: true }),
      copy({ 'static/module.json': 'dist/module.json', 'static/data': 'dist/data'})
    ],
    output: [{ file: pkg.main, format: 'es' }]
  }
];
