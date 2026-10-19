export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting AirTrail': 0,
  'The database is not accepting connections': 1,
  'Web Interface': 2,
  'The web interface is ready': 3,
  'The web interface is not ready': 4,

  // interfaces.ts
  'Web UI': 5,
  'The AirTrail web app, and the address of its REST API and MCP endpoint': 6,

  // init/watchOwnerPassword.ts
  'Create the owner account before starting AirTrail': 7,

  // utils.ts, actions/setOwnerPassword.ts
  Username: 8,
  'The username the owner signs in to AirTrail with. Changing it here renames the owner account.': 9,
  '3 to 20 letters, numbers, periods, underscores or hyphens': 10,
  'Set Owner Password': 11,
  'Choose the username the AirTrail owner signs in with and generate a new password for it. The first run creates the owner account.': 12,
  'Replaces the owner’s current password.': 13,
  'The package has not finished installing': 14,
  'That username already belongs to another AirTrail account': 15,
  'AirTrail could not apply the password. The service log has the details.': 16,
  'Owner Login': 17,
  'The new password is active. Sign in to AirTrail with it.': 18,
  'AirTrail applies this password when it next starts. Sign in with it once it is running.': 19,
  Password: 20,

  // actions/resetUserPassword.ts
  Account: 21,
  'The AirTrail account to give a new password. The owner’s password is set with Set Owner Password.': 22,
  'Reset User Password': 23,
  'Generate a new password for someone else’s AirTrail account, for when they cannot sign in.': 24,
  'Replaces that person’s current password.': 25,
  'That account no longer exists': 26,
  'New Password': 27,
  'The new password is active. Give it to this person to sign in with; they can change it under Settings → Security in AirTrail.': 28,

  // actions/requestAccess.ts, approveAccess.ts, revokeAccess.ts
  'Request Access': 29,
  'Ask for read access to one AirTrail account with an API key the requesting service generated': 30,
  'Key Hash': 31,
  'SHA-256 of the API key, in lowercase hex': 32,
  'Must be 64 lowercase hex characters': 33,
  Permissions: 34,
  'At most 64 characters, without angle brackets or control characters': 35,
  'Only a service can request access': 36,
  'Choose at least one permission': 37,
  'This key was already requested': 38,
  '${packageId} is asking to read flights in an AirTrail account': 39,
  'has a key from ${services}': 40,
  'Approve Access': 41,
  "Let a service read one AirTrail account's flights with the permissions it asked for, or deny its request": 42,
  'Only the user can approve access': 43,
  Request: 44,
  'The service asking, and what it would be allowed to read': 45,
  Decision: 46,
  'If the chosen account already has a key from this service, approving replaces it': 47,
  Approve: 48,
  'AirTrail Account': 49,
  'The account whose flights the service can read': 50,
  Deny: 51,
  'That request is no longer pending': 52,
  'No AirTrail account has the ID ${userId}, or it was deleted': 53,
  'Access Approved': 54,
  'This replaced the key ${packageId} already had in this account.': 55,
  'Revoke Access': 56,
  "Delete the requesting service's API key, or withdraw its pending request": 57,
  'Only a service can revoke its access': 58,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
