import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'public/mockServiceWorker.js', 'plan/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
]

export default config
