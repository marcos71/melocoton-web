import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { manifest } from './manifest'

describe('PWA manifest', () => {
  it('isInSpanishAndInstallable', () => {
    expect(manifest.name).toBe('Melocotón')
    expect(manifest.short_name).toBe('Melocotón')
    expect(manifest.lang).toBe('es-AR')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('hasRegularAndMaskableIconsThatExist', () => {
    const icons = manifest.icons ?? []

    expect(icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    )
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      expect(existsSync(resolve(process.cwd(), 'public', icon.src)), icon.src).toBe(true)
    }
  })
})
