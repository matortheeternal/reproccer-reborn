import pug from 'rollup-plugin-pug-html';
import copy from 'rollup-plugin-copy';
import pkg from './package.json';

export default [
  {
    input: 'src/index.js',
    external: [],
    plugins: [
      pug({ include: 'src/**/*.pug', pretty: true }),
      copy({ 'static/module.json': 'dist/module.json', 'static/data': 'dist/data'})
    ],
    output: [
      { file: pkg.main, format: 'es' },
    ]
  }
];
