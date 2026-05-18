import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If you fork this repo with a different name, update `base` to match.
// For user/organization sites (username.github.io), set base to '/'.
// For project sites (username.github.io/joymatrix/), keep '/joymatrix/'.
const repoName = 'joymatrix'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
})
