import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.14.0:0',
  releaseNotes: {
    en_US:
      'Updated AirTrail to 3.14.0: a redesigned statistics page, a calendar feed your calendar app can subscribe to, optional aircraft photos, and imports from LogMyTrip. [Full release notes](https://github.com/johanohly/AirTrail/releases/tag/v3.14.0)',
    es_ES:
      'AirTrail actualizado a 3.14.0: página de estadísticas rediseñada, un calendario al que tu aplicación de calendario puede suscribirse, fotos opcionales de aeronaves e importación desde LogMyTrip. [Notas completas](https://github.com/johanohly/AirTrail/releases/tag/v3.14.0)',
    de_DE:
      'AirTrail auf 3.14.0 aktualisiert: neu gestaltete Statistikseite, ein Kalender-Feed, den deine Kalender-App abonnieren kann, optionale Flugzeugfotos und Importe aus LogMyTrip. [Vollständige Versionshinweise](https://github.com/johanohly/AirTrail/releases/tag/v3.14.0)',
    pl_PL:
      'Zaktualizowano AirTrail do wersji 3.14.0: przeprojektowana strona statystyk, kanał kalendarza, który może subskrybować aplikacja kalendarza, opcjonalne zdjęcia samolotów i import z LogMyTrip. [Pełne informacje o wydaniu](https://github.com/johanohly/AirTrail/releases/tag/v3.14.0)',
    fr_FR:
      "AirTrail mis à jour vers 3.14.0 : page de statistiques repensée, un flux de calendrier auquel votre application de calendrier peut s'abonner, photos d'avions facultatives et import depuis LogMyTrip. [Notes de version complètes](https://github.com/johanohly/AirTrail/releases/tag/v3.14.0)",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
