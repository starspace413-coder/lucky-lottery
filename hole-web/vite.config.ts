import { defineConfig } from 'vite'

// GitHub Pages: set base to '/<repo>/' when deploying.
// If your repo is named `hole-web`, keep as-is.
// If you rename the repo, update BASE accordingly.
const BASE = '/hole-web/'

export default defineConfig({
  base: BASE,
})
