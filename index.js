// OpenCode 2.0.30 resolves a local plugin directory only to a root `index.js`/`server.js`
// (it does not follow `package.json` exports for path entries), so this shim must stay at the
// repository root and re-export the implementation from `src/`.
export { default } from "./src/index.js"
export * from "./src/index.js"
