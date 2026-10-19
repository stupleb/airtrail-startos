import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  credentialsResult,
  getLiveOwnerUsername,
  getRandomPassword,
  runAccountsScript,
  usernameRegex,
} from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  username: Value.text({
    name: i18n('Username'),
    description: i18n(
      'The username the owner signs in to AirTrail with. Changing it here renames the owner account.',
    ),
    required: true,
    default: null,
    patterns: [
      {
        regex: usernameRegex,
        description: i18n(
          '3 to 20 letters, numbers, periods, underscores or hyphens',
        ),
      },
    ],
  }),
})

export const setOwnerPassword = sdk.Action.withInput(
  'set-owner-password',

  async ({ effects }) => ({
    name: i18n('Set Owner Password'),
    description: i18n(
      'Choose the username the AirTrail owner signs in with and generate a new password for it. The first run creates the owner account.',
    ),
    warning: (await storeJson.read((s) => s.ownerPassword).const(effects))
      ? i18n('Replaces the owner’s current password.')
      : null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  // The owner may have been renamed inside AirTrail since the package set it.
  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store?.ownerPassword) return {}
    return {
      username: (await getLiveOwnerUsername(effects)) ?? store.ownerUsername,
    }
  },

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    const postgresPassword = store?.postgresPassword
    if (!store || !postgresPassword) {
      throw new Error(i18n('The package has not finished installing'))
    }
    const password = getRandomPassword()
    let username = input.username
    let applied = false

    if (store.ownerPassword) {
      const res = await runAccountsScript(effects, postgresPassword, {
        STARTOS_TASK: 'set-owner',
        STARTOS_USERNAME: username,
        STARTOS_PASSWORD: password,
        STARTOS_APPLY: 'true',
        STARTOS_STRICT: 'true',
      })
      if (res.stderr.includes('STARTOS_USERNAME_TAKEN')) {
        throw new Error(
          i18n('That username already belongs to another AirTrail account'),
        )
      }
      if (res.exitCode === 0) {
        username = res.stdout.match(/^STARTOS_USERNAME=(.+)$/m)?.[1] ?? username
        applied = true
      } else if (!res.stderr.includes('STARTOS_DB_UNREACHABLE')) {
        console.error(`accounts.mjs failed: ${res.stderr}`)
        throw new Error(
          i18n(
            'AirTrail could not apply the password. The service log has the details.',
          ),
        )
      }
    }

    await storeJson.merge(effects, {
      ownerUsername: username,
      ownerPassword: password,
      ownerPasswordPending: !applied,
    })

    return credentialsResult(
      i18n('Owner Login'),
      applied
        ? i18n('The new password is active. Sign in to AirTrail with it.')
        : i18n(
            'AirTrail applies this password when it next starts. Sign in with it once it is running.',
          ),
      username,
      password,
    )
  },
)
