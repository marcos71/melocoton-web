import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// DI-85: react-aria-components ships unstyled; every style goes through our CSS Modules and tokens.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) && !name.endsWith('noLibraryStylesheet.test.ts') ? [path] : []
  })
}

/** Imports of a stylesheet that comes from react-aria-components (or any react-aria package). */
function libraryStylesheetImports(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /(?<!@)import\s+(?:[^'"]*?\sfrom\s+)?['"]((?:react-aria|@react-aria)[^'"]*\.css)['"]/g,
    /@import\s+(?:url\()?['"]?((?:react-aria|@react-aria)[^'")\s;]*)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1] ?? '')
  }
  return found
}

describe('react-aria-components styles (DI-85)', () => {
  it('DI85_detectsAStylesheetImportedFromTheLibrary', () => {
    expect(libraryStylesheetImports("import 'react-aria-components/theme.css'")).toEqual([
      'react-aria-components/theme.css',
    ])
    expect(libraryStylesheetImports('@import "react-aria-components/style.css";')).toEqual([
      'react-aria-components/style.css',
    ])
    expect(
      libraryStylesheetImports("import { Button } from 'react-aria-components'\nimport s from './a.module.css'"),
    ).toEqual([])
  })

  it('DI85_noLibraryStylesheetIsImported', () => {
    const files = sourceFiles(resolve(process.cwd(), 'src'))
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      expect(libraryStylesheetImports(readFileSync(file, 'utf8')), file).toEqual([])
    }
  })
})
