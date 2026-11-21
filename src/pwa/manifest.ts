import type { ManifestOptions } from 'vite-plugin-pwa'

// Web app manifest. Everything a person reads here is in Spanish (DI-20).
export const manifest: Partial<ManifestOptions> = {
  name: 'Melocotón',
  short_name: 'Melocotón',
  description: 'Turnos, piezas y pagos del taller de cerámica.',
  lang: 'es-AR',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#ffffff',
  theme_color: '#111111',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
