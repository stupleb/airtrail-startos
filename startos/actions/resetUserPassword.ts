import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  credentialsResult,
  getRandomPassword,
  listOtherUsers,
  runAccountsScript,
} from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  userId: Value.dynamicSelect(async ({ effects }) => ({
    name: i18n('Account'),
    description: i18n(
      'The AirTrail account to give a new password. The owner’s password is set with Set Owner Password.',
    ),
    values: Object.fromEntries(
      (await listOtherUsers(effects)).map((u) => [
        u.id,
        `${u.username} (${u.displayName})`,
      ]),
    ),
    default: null,
  })),
})

export const resetUserPassword = sdk.Action.withInput(
  'reset-user-password',

  async () => ({
    name: i18n('Reset User Password'),
    description: i18n(
      'Generate a new password for someone else’s AirTrail account, for when they cannot sign in.',
    ),
    warning: i18n('Replaces that person’s current password.'),
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const postgresPassword = await storeJson
      .read((s) => s.postgresPassword)
      .once()
    if (!postgresPassword) {
      throw new Error(i18n('The package has not finished installing'))
    }
    const password = getRandomPassword()
    const res = await runAccountsScript(effects, postgresPassword, {
      STARTOS_TASK: 'reset-user',
      STARTOS_USER_ID: input.userId,
      STARTOS_PASSWORD: password,
    })
    if (res.stderr.includes('STARTOS_USER_MISSING')) {
      throw new Error(i18n('That account no longer exists'))
    }
    if (res.exitCode !== 0) {
      console.error(`accounts.mjs failed: ${res.stderr}`)
      throw new Error(
        i18n(
          'AirTrail could not apply the password. The service log has the details.',
        ),
      )
    }

    return credentialsResult(
      i18n('New Password'),
      i18n(
        'The new password is active. Give it to this person to sign in with; they can change it under Settings → Security in AirTrail.',
      ),
      res.stdout.match(/^STARTOS_USERNAME=(.+)$/m)?.[1] ?? '',
      password,
    )
  },
)
