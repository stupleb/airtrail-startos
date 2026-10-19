import { setOwnerPassword } from '../actions/setOwnerPassword'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const watchOwnerPassword = sdk.setupOnInit(async (effects) => {
  const password = await storeJson.read((s) => s.ownerPassword).const(effects)
  if (!password) {
    await sdk.action.createOwnTask(effects, setOwnerPassword, 'critical', {
      reason: i18n('Create the owner account before starting AirTrail'),
    })
  }
})
