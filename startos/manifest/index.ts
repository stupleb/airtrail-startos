import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'airtrail',
  title: 'AirTrail',
  license: 'GPL-3.0',
  packageRepo: 'https://github.com/stupleb/airtrail-startos',
  upstreamRepo: 'https://github.com/johanohly/AirTrail',
  marketingUrl: 'https://airtrail.johan.ohly.dk',
  donationUrl: null,
  description: { short, long },
  volumes: ['startos', 'main', 'db'],
  images: {
    airtrail: {
      source: {
        dockerBuild: { buildArgs: { IMAGE: 'johly/airtrail:v3.13.0' } },
      },
      arch: ['x86_64', 'aarch64'],
    },
    postgres: {
      source: { dockerTag: 'postgres:16.15-alpine' },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
