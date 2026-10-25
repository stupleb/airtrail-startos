import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.13.1:0',
  releaseNotes: {
    en_US:
      'Updated AirTrail to 3.13.1, which includes the October 2026 Node.js security fixes.',
    es_ES:
      'AirTrail actualizado a 3.13.1, que incluye las correcciones de seguridad de Node.js de octubre de 2026.',
    de_DE:
      'AirTrail auf 3.13.1 aktualisiert, das die Node.js-Sicherheitskorrekturen vom Oktober 2026 enthält.',
    pl_PL:
      'Zaktualizowano AirTrail do wersji 3.13.1, która zawiera poprawki bezpieczeństwa Node.js z października 2026.',
    fr_FR:
      "AirTrail mis à jour vers 3.13.1, qui inclut les correctifs de sécurité Node.js d'octobre 2026.",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
