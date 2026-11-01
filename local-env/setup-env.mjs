// Creates the local secret and the test JWT once, and points the frontend at the local services.
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = join(here, '.env')
const frontendEnvPath = join(here, '..', '.env.local')

const TENANT_ID = '019a1c00-0000-7000-8000-000000000001'
// The services require exp, so "no expiry" means 2100-01-01.
const EXPIRES_AT = 4102444800

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function signToken(secret) {
  const unsigned = `${base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify({ tenant_id: TENANT_ID, exp: EXPIRES_AT }),
  )}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )
}

function serializeEnv(values) {
  return `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n')}\n`
}

if (!existsSync(envPath)) {
  const secret = randomBytes(32).toString('hex')
  writeFileSync(envPath, serializeEnv({ JWT_SECRET: secret, TENANT_ID, DEV_JWT: signToken(secret) }), { mode: 0o600 })
}

const { DEV_JWT } = parseEnv(readFileSync(envPath, 'utf8'))
const frontendEnv = existsSync(frontendEnvPath) ? parseEnv(readFileSync(frontendEnvPath, 'utf8')) : {}
writeFileSync(
  frontendEnvPath,
  serializeEnv({
    ...frontendEnv,
    NEXT_PUBLIC_API_MOCKS: 'false',
    TASK_SERVICE_URL: 'http://localhost:8080',
    JOB_SERVICE_URL: 'http://localhost:8081',
    DEV_JWT,
  }),
  { mode: 0o600 },
)
