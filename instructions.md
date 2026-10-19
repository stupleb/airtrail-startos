# AirTrail

## Documentation

- [Adding flights](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/features/add-flight.mdx) — entering a flight by hand or looking it up by flight number
- [Importing flights](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/features/import.mdx) — bringing in your history from MyFlightradar24, App in the Air, Flighty, TripIt and other trackers
- [Sharing](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/features/sharing.mdx) — public, read-only links to your flights
- [Roles and permissions](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/administration/roles.mdx) — what the owner, administrators and users can do
- [OAuth sign-in](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/features/oauth.mdx) — signing in with an OpenID Connect provider
- [API keys and connected apps](https://github.com/johanohly/AirTrail/blob/main/docs/content/docs/features/api-keys.mdx) — keys for scripts, integrations and MCP clients

## What you get on StartOS

- **Web UI** — AirTrail itself. The same address serves its REST API and MCP endpoint.
- An **owner account** created for you, so nobody else can claim the instance by opening it first. The owner adds everyone else.
- Your flights, users and settings in AirTrail's database, which StartOS backs up.

## Getting set up

1. Run **Set Owner Password**, the task on AirTrail's page. Choose the username you will sign in with. The action shows that username and a new password; keep the password somewhere safe.
2. Start AirTrail. On its first start it downloads the world's airports and airline data, which takes a minute or so, before the **Web UI** opens.
3. Open the **Web UI** and sign in as the owner.
4. Add your flights, or import them from another tracker under **Settings → Import**.
5. To give someone their own account, open **Settings → Users** and click **Add user**.

## Using AirTrail

### Sign in over HTTPS

Use one of the Web UI's HTTPS addresses. On a plain `http://` address, including an `http` onion address, AirTrail refuses the sign-in with "Cross-site POST form submissions are forbidden".

### Set Owner Password

Run it again whenever you lose the owner's password, or to change the owner's username. It replaces the password straight away if AirTrail is running, or the next time AirTrail starts if it isn't.

### Reset User Password

When someone else can't sign in, run **Reset User Password** while AirTrail is running and pick their account. It shows their username and a new password to give them; they can change it under **Settings → Security** in AirTrail.

### When another service asks to read your flights

A service on your server that works with AirTrail, such as Dawarich, asks for access instead of needing an API key copied into it. A task appears on AirTrail's page naming the service, and usually whose account it is for. Open it, choose the AirTrail account whose flights that service may read, and approve, or deny the request. The service can only read; it never changes your flights. The key it gets is listed under that account's **Settings → Security** in AirTrail, where deleting it ends the access.

### Flight lookups

Looking a flight up by its number works without setup. For better coverage, and for flights on a specific date, add an AeroDataBox API key under **Settings → Integrations**.

### Updates

AirTrail may tell you a newer version is available. Updates reach your server through StartOS, once this package has been updated.
