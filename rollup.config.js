import babel from "rollup-plugin-babel";
import copy from "rollup-plugin-copy";
import pkg from "./package.json";

export default [
  {
    input: "src/index.js",
    external: ["ngapp", "info", "xelib"],
    plugins: [
      babel({
        exclude: "node_modules/**",
        plugins: ["external-helpers"],
        externalHelpers: true
      }),
      copy({
        "static/settings.html": "dist/settings.html",
        "static/module.json": "dist/module.json",
        "static/data": "dist/data"
      })
    ],
    output: [{ file: pkg.main, format: "es" }]
  }
];
