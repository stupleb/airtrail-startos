import { T, utils } from '@start9labs/start-sdk'
import { createHash } from 'crypto'
import { DependentKey, storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'

export const uiPort = 3000
export const uiHostId = 'main'
export const uiInterfaceId = 'ui'

export const POSTGRES_PATH = '/var/lib/postgresql'
export const DB_NAME = 'airtrail'
export const DB_USER = 'airtrail'

// Inside /app, so assets/accounts.mjs resolves the image's own node_modules.
export const ASSETS_PATH = '/app/startos'
export const UPLOADS_PATH = '/app/uploads'

// AirTrail's own username rules (usernameSchema in src/lib/zod/user.ts).
export const usernameRegex = '^[A-Za-z0-9._-]{3,20}$'

export const dbMounts = sdk.Mounts.of().mountVolume({
  volumeId: 'db',
  subpath: null,
  mountpoint: POSTGRES_PATH,
  readonly: false,
})

export const assetMounts = sdk.Mounts.of().mountAssets({
  subpath: null,
  mountpoint: ASSETS_PATH,
})

export const appMounts = sdk.Mounts.of()
  .mountVolume({
    volumeId: 'main',
    subpath: 'uploads',
    mountpoint: UPLOADS_PATH,
    readonly: false,
  })
  .mountAssets({ subpath: null, mountpoint: ASSETS_PATH })

export function getRandomPassword(): string {
  return utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 32 })
}

export async function getDatabasePassword(): Promise<string> {
  const password = await storeJson.read((s) => s.postgresPassword).once()
  if (!password) throw new Error('No postgresPassword in store.json')
  return password
}

export function postgresEnv(password: string) {
  return {
    POSTGRES_DB: DB_NAME,
    POSTGRES_USER: DB_USER,
    POSTGRES_PASSWORD: password,
  }
}

export function appEnv(postgresPassword: string): Record<string, string> {
  return {
    DB_URL: `postgres://${DB_USER}:${postgresPassword}@127.0.0.1:5432/${DB_NAME}`,
    UPLOAD_LOCATION: UPLOADS_PATH,
    ADDRESS_HEADER: 'X-Forwarded-For',
  }
}

const psql = (sql: string) => [
  'psql',
  '-h',
  '127.0.0.1',
  '-U',
  DB_USER,
  '-d',
  DB_NAME,
  '-v',
  'ON_ERROR_STOP=1',
  '-qtA',
  '-F',
  '\t',
  '-c',
  sql,
]

// psql output of a query, or null when the database is not answering.
async function queryDatabase(
  effects: T.Effects,
  sql: string,
): Promise<string | null> {
  const password = await storeJson.read((s) => s.postgresPassword).once()
  if (!password) return null
  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'postgres' },
    sdk.Mounts.of(),
    'query-database',
    async (sub) => {
      const res = await sub.exec(psql(sql), {
        env: { PGPASSWORD: password, PGCONNECT_TIMEOUT: '3' },
      })
      return res.exitCode === 0 ? res.stdout.toString() : null
    },
  )
}

export async function getLiveOwnerUsername(
  effects: T.Effects,
): Promise<string | null> {
  const out = await queryDatabase(
    effects,
    'SELECT username FROM "user" WHERE is_owner LIMIT 1',
  )
  return out?.trim() || null
}

export async function listOtherUsers(
  effects: T.Effects,
): Promise<{ id: string; username: string; displayName: string }[]> {
  const out = await queryDatabase(
    effects,
    'SELECT id, username, display_name FROM "user" WHERE NOT is_owner ORDER BY lower(username)',
  )
  return (out ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, username, ...displayName] = line.split('\t')
      return { id, username, displayName: displayName.join('\t') }
    })
}

export function credentialsResult(
  title: string,
  message: string,
  username: string,
  password: string,
): { version: '1' } & T.ActionResultV1 {
  return {
    version: '1',
    title,
    message,
    result: {
      type: 'group',
      value: [
        {
          type: 'single',
          name: i18n('Username'),
          description: null,
          value: username,
          masked: false,
          copyable: true,
          qr: false,
          launchable: false,
        },
        {
          type: 'single',
          name: i18n('Password'),
          description: null,
          value: password,
          masked: true,
          copyable: true,
          qr: false,
          launchable: false,
        },
      ],
    },
  }
}

// Runs assets/accounts.mjs against the running database; README.md § Actions describes its variables.
export async function runAccountsScript(
  effects: T.Effects,
  postgresPassword: string,
  env: Record<string, string>,
) {
  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'airtrail' },
    assetMounts,
    'accounts',
    async (sub) => {
      const res = await sub.exec(['node', `${ASSETS_PATH}/accounts.mjs`], {
        cwd: '/app',
        env: { ...appEnv(postgresPassword), ...env },
      })
      return {
        exitCode: res.exitCode,
        stdout: res.stdout.toString(),
        stderr: res.stderr.toString(),
      }
    },
  )
}

export type Sql = (query: string) => Promise<string>

type PsqlSub = {
  execFail(
    command: string[],
    options?: { env?: Record<string, string> },
  ): Promise<{ stdout: string | Buffer }>
}

export function sqlOn(sub: PsqlSub, password: string): Sql {
  return async (query) =>
    (await sub.execFail(psql(query), { env: { PGPASSWORD: password } })).stdout
      .toString()
      .trim()
}

export async function withDb<R>(
  effects: T.Effects,
  fn: (sql: Sql) => Promise<R>,
): Promise<R> {
  const password = await getDatabasePassword()
  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'postgres' },
    sdk.Mounts.of(),
    'access-db',
    (sub) => fn(sqlOn(sub, password)),
  )
}

export const sqlLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`

// What another service may ask for: reading one person's own flights, never writing.
export const dependentKeyScopes = {
  'profile.read': 'profile.read',
  'flight.read.own': 'flight.read.own',
  'flight.export.own': 'flight.export.own',
  'stats.read': 'stats.read',
  'tracks.read': 'tracks.read',
  'visited_countries.read': 'visited_countries.read',
  'reference_data.read': 'reference_data.read',
}

export async function listAirtrailUsers(sql: Sql) {
  return (
    await sql(
      'SELECT id, username, display_name FROM "user" ORDER BY is_owner DESC, lower(username)',
    )
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, username, ...displayName] = line.split('\t')
      return { id, username, displayName: displayName.join('\t') }
    })
}

export function accessRequestId(
  key: Pick<DependentKey, 'packageId' | 'keyHash' | 'permissions'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([key.packageId, key.keyHash, [...key.permissions].sort()]),
    )
    .digest('hex')
}

export const accessTaskId = (requestId: string) => `access-request:${requestId}`

export const requesterName = (
  key: Pick<DependentKey, 'packageId' | 'label'>,
) => (key.label ? `${key.packageId} (${key.label})` : key.packageId)

let dependentKeyQueue: Promise<void> = Promise.resolve()

export function withDependentKeyLock<R>(
  operation: () => Promise<R>,
): Promise<R> {
  const result = dependentKeyQueue.then(operation)
  dependentKeyQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

// AirTrail stores base64(sha256(key)); requests carry the same digest in hex. Null when the account is gone.
export async function insertDependentKey(
  sql: Sql,
  key: Pick<DependentKey, 'packageId' | 'keyHash' | 'permissions'>,
  userId: string,
): Promise<string | null> {
  const stored = Buffer.from(key.keyHash, 'hex').toString('base64')
  const id = await sql(
    `INSERT INTO api_key (name, user_id, key, scopes) SELECT ${sqlLiteral(`StartOS: ${key.packageId}`)}, id, ${sqlLiteral(stored)}, ARRAY[${key.permissions.map(sqlLiteral).join(', ')}]::text[] FROM "user" WHERE id = ${sqlLiteral(userId)} RETURNING id`,
  )
  return id || null
}

const keyIdList = (keyIds: string[]) =>
  keyIds.filter((id) => /^[0-9]+$/.test(id)).join(', ')

export async function existingKeyIds(
  sql: Sql,
  keyIds: string[],
): Promise<string[]> {
  if (!keyIdList(keyIds)) return []
  return (
    await sql(`SELECT id FROM api_key WHERE id IN (${keyIdList(keyIds)})`)
  )
    .split('\n')
    .filter(Boolean)
}

export async function dropDependentKeys(
  effects: T.Effects,
  sql: Sql,
  match: (key: DependentKey) => boolean,
): Promise<void> {
  const dropped = (
    (await storeJson.read((s) => s.dependentKeys).once()) ?? []
  ).filter(match)
  if (!dropped.length) return

  const keyIds = keyIdList(dropped.flatMap((k) => (k.keyId ? [k.keyId] : [])))
  if (keyIds) await sql(`DELETE FROM api_key WHERE id IN (${keyIds})`)
  const pending = dropped.filter((k) => !k.keyId)
  if (pending.length) {
    await sdk.action.clearTask(
      effects,
      ...pending.map((k) => accessTaskId(accessRequestId(k))),
    )
  }

  const hashes = new Set(dropped.map((k) => k.keyHash))
  await storeJson.update(
    effects,
    (s) =>
      s && {
        ...s,
        dependentKeys: s.dependentKeys.filter((k) => !hashes.has(k.keyHash)),
      },
  )
}
