// Run by node from /app/startos; README.md § Actions describes each STARTOS_* variable.
import { randomInt } from 'node:crypto'
import { hash } from '@node-rs/argon2'
import pg from 'pg'

const task = process.env.STARTOS_TASK
const username = process.env.STARTOS_USERNAME
const userId = process.env.STARTOS_USER_ID
const password = process.env.STARTOS_PASSWORD
const apply = process.env.STARTOS_APPLY === 'true'
const strict = process.env.STARTOS_STRICT === 'true'

// AirTrail's hashArgon2, src/lib/server/utils/hash.ts.
const hashPassword = (value) =>
  hash(value.normalize('NFKC'), {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  })

// The id format of lucia's generateId(15), which AirTrail's sign-up uses.
const newUserId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 15 }, () => chars[randomInt(chars.length)]).join('')
}

const client = new pg.Client({
  connectionString: process.env.DB_URL,
  connectionTimeoutMillis: 5000,
})

async function setOwner() {
  const {
    rows: [owner],
  } = await client.query('SELECT id, username FROM "user" WHERE is_owner LIMIT 1')

  if (!owner) {
    await client.query(
      'INSERT INTO "user" (id, username, display_name, password, is_owner) VALUES ($1, $2, $2, $3, true)',
      [newUserId(), username, await hashPassword(password)],
    )
    console.log(`STARTOS_USERNAME=${username}`)
    return 0
  }

  if (!apply) return 0

  let name = owner.username
  if (username !== owner.username) {
    const { rowCount } = await client.query(
      'SELECT 1 FROM "user" WHERE lower(username) = lower($1) AND id <> $2',
      [username, owner.id],
    )
    if (!rowCount) {
      name = username
    } else if (strict) {
      console.error(`STARTOS_USERNAME_TAKEN=${username}`)
      return 1
    } else {
      console.warn(
        `${username} belongs to another account; the owner keeps ${owner.username}`,
      )
    }
  }
  await client.query(
    'UPDATE "user" SET username = $1, password = $2 WHERE id = $3',
    [name, await hashPassword(password), owner.id],
  )
  console.log(`STARTOS_USERNAME=${name}`)
  return 0
}

async function resetUser() {
  const {
    rows: [user],
  } = await client.query(
    'UPDATE "user" SET password = $1 WHERE id = $2 AND NOT is_owner RETURNING username',
    [await hashPassword(password), userId],
  )
  if (!user) {
    console.error(`STARTOS_USER_MISSING=${userId}`)
    return 1
  }
  console.log(`STARTOS_USERNAME=${user.username}`)
  return 0
}

async function run() {
  try {
    await client.connect()
  } catch (err) {
    console.error(`STARTOS_DB_UNREACHABLE=${err.code ?? err.message}`)
    return 1
  }
  try {
    return task === 'reset-user' ? await resetUser() : await setOwner()
  } catch (err) {
    // No tables until AirTrail's migrations have run once.
    if (err.code === '42P01') {
      console.error('STARTOS_DB_UNREACHABLE=42P01')
      return 1
    }
    throw err
  } finally {
    await client.end()
  }
}

process.exitCode = await run()
