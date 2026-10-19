import { sdk } from '../sdk'
import { approveAccess } from './approveAccess'
import { requestAccess } from './requestAccess'
import { resetUserPassword } from './resetUserPassword'
import { revokeAccess } from './revokeAccess'
import { setOwnerPassword } from './setOwnerPassword'

export const actions = sdk.Actions.of()
  .addAction(setOwnerPassword)
  .addAction(resetUserPassword)
  .addAction(requestAccess)
  .addAction(approveAccess)
  .addAction(revokeAccess)
