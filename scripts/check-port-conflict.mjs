import config from '../vite.config.ts'
const server = config.server
const preview = config.preview
if (server?.port !== 5175 || !server.strictPort || preview?.port !== 4175 || !preview.strictPort)
  throw new Error('WireFactory requires strict ports 5175 and 4175.')
console.log('WireFactory ports are strict: 5175 / 4175')
