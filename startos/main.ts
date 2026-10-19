import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  ASSETS_PATH,
  DB_USER,
  appEnv,
  appMounts,
  dbMounts,
  dropDependentKeys,
  existingKeyIds,
  postgresEnv,
  sqlOn,
  uiPort,
  withDependentKeyLock,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting AirTrail'))

  const postgresPassword = await storeJson
    .read((s) => s.postgresPassword)
    .const(effects)
  if (!postgresPassword) {
    throw new Error('store.json is missing its generated database password')
  }

  // Read once: Set Owner Password applies a password itself while the database is up.
  const owner = await storeJson
    .read((s) => ({
      username: s.ownerUsername,
      password: s.ownerPassword,
      pending: s.ownerPasswordPending,
    }))
    .once()
  if (!owner?.username || !owner.password) {
    throw new Error('No owner account has been set up')
  }

  const env = appEnv(postgresPassword)

  const postgresSub = sdk.SubContainer.of(
    effects,
    { imageId: 'postgres' },
    dbMounts,
    'postgres',
  )
  const appSub = sdk.SubContainer.of(
    effects,
    { imageId: 'airtrail' },
    appMounts,
    'airtrail',
  )

  return (
    sdk.Daemons.of(effects)
      .addDaemon('postgres', {
        subcontainer: postgresSub,
        exec: {
          command: sdk.useEntrypoint(['-c', 'listen_addresses=127.0.0.1']),
          env: postgresEnv(postgresPassword),
        },
        ready: {
          display: null,
          fn: async () => {
            const { exitCode } = await postgresSub.exec([
              'pg_isready',
              '-q',
              '-h',
              '127.0.0.1',
              '-U',
              DB_USER,
              '-t',
              '15',
            ])
            return exitCode === 0
              ? { result: 'success', message: null }
              : {
                  result: 'failure',
                  message: i18n('The database is not accepting connections'),
                }
          },
        },
        requires: [],
      })
      .addOneshot('setup', {
        subcontainer: appSub,
        exec: {
          command: [
            'sh',
            '-c',
            'node docker/migrate.js && node "$1"',
            'setup',
            `${ASSETS_PATH}/accounts.mjs`,
          ],
          cwd: '/app',
          env: {
            ...env,
            STARTOS_TASK: 'set-owner',
            STARTOS_USERNAME: owner.username,
            STARTOS_PASSWORD: owner.password,
            STARTOS_APPLY: owner.pending ? 'true' : 'false',
          },
        },
        requires: ['postgres'],
      })
      .addOneshot('owner-applied', {
        subcontainer: null,
        exec: {
          fn: async () => {
            const stored = await storeJson.read((s) => s.ownerPassword).once()
            if (owner.pending && stored === owner.password) {
              await storeJson.merge(effects, { ownerPasswordPending: false })
            }
            return null
          },
        },
        requires: ['setup'],
      })
      // Forgets keys of uninstalled services, and records whose key a user deleted in AirTrail.
      .addOneshot('reconcile-dependent-keys', {
        subcontainer: postgresSub,
        exec: {
          fn: () =>
            withDependentKeyLock(async () => {
              const sql = sqlOn(postgresSub, postgresPassword)
              const installed = new Set(await sdk.getInstalledPackages(effects))
              await dropDependentKeys(
                effects,
                sql,
                (k) => !installed.has(k.packageId),
              )
              const keyIds = (
                (await storeJson.read((s) => s.dependentKeys).once()) ?? []
              ).flatMap((k) => (k.keyId ? [k.keyId] : []))
              const live = new Set(await existingKeyIds(sql, keyIds))
              await dropDependentKeys(
                effects,
                sql,
                (k) => !!k.keyId && !live.has(k.keyId),
              )
              return null
            }),
        },
        requires: ['owner-applied'],
      })
      .addDaemon('airtrail', {
        subcontainer: appSub,
        exec: {
          command: sdk.useEntrypoint(),
          cwd: '/app',
          env,
        },
        ready: {
          display: i18n('Web Interface'),
          gracePeriod: 300_000,
          // AirTrail opens its port only after loading its airport data.
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, uiPort, {
              successMessage: i18n('The web interface is ready'),
              errorMessage: i18n('The web interface is not ready'),
            }),
        },
        requires: ['owner-applied'],
      })
  )
})
