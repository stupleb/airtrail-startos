import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const dependentKey = z.looseObject({
  packageId: z.string(),
  keyHash: z.string(),
  permissions: z.array(z.string()),
  label: z.string().nullish(),
  userId: z.string().nullable(),
  keyId: z.string().nullable(),
})
export type DependentKey = z.infer<typeof dependentKey>

const shape = z.looseObject({
  postgresPassword: z.string().optional().catch(undefined),
  ownerUsername: z.string().optional().catch(undefined),
  ownerPassword: z.string().optional().catch(undefined),
  // Set when the password could not reach the database; setup applies it on the next start.
  ownerPasswordPending: z.boolean().catch(false),
  // A null keyId is a request the user has not yet approved.
  dependentKeys: z.array(dependentKey).catch([]),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.startos, subpath: './store.json' },
  shape,
)
