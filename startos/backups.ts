import { sdk } from './sdk'
import { DB_NAME, DB_USER, POSTGRES_PATH, getDatabasePassword } from './utils'

export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.withPgDump({
    imageId: 'postgres',
    dbVolume: 'db',
    mountpoint: POSTGRES_PATH,
    pgdataPath: '/data',
    database: DB_NAME,
    user: DB_USER,
    password: getDatabasePassword,
  })
    .addVolume('startos')
    .addVolume('main'),
)
