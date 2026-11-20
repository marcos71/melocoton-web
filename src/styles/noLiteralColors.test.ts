import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// DI-47: every color comes from a token in global.css, never a literal in a CSS Module.
const ALLOWED_KEYWORDS = new Set(['transparent', 'currentcolor', 'inherit'])

const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab
orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru
pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan
teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
    .split(/\s+/),
)

function cssModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return cssModules(path)
    return name.endsWith('.module.css') ? [path] : []
  })
}

/** Returns the literal colors found in the declaration values of a stylesheet. */
function literalColors(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: string[] = []
  for (const declaration of withoutComments.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const value = (declaration[2] ?? '')
      .replace(/(['"]).*?\1/g, '') // strings, e.g. content: '✕ '
      .replace(/var\([^)]*\)/g, '') // tokens
    for (const hex of value.matchAll(/#[0-9a-f]{3,8}\b/gi)) found.push(hex[0])
    for (const fn of value.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi)) found.push(fn[0])
    for (const word of value.matchAll(/[a-z]+/gi)) {
      const keyword = word[0].toLowerCase()
      if (NAMED_COLORS.has(keyword) && !ALLOWED_KEYWORDS.has(keyword)) found.push(word[0])
    }
  }
  return found
}

describe('CSS Modules colors (DI-47)', () => {
  it('DI47_detectsLiteralColors', () => {
    expect(
      literalColors('a { color: #fff; background: rgb(0 0 0 / 0.5); border: 1px solid red; }'),
    ).toEqual(['#fff', 'rgb(', 'red'])
    expect(
      literalColors(
        "a { color: var(--color-ink); border-color: transparent; outline: 2px solid currentColor; content: 'red'; background: color-mix(in srgb, var(--color-ink) 60%, transparent); }",
      ),
    ).toEqual([])
  })

  it('DI47_noCssModuleUsesALiteralColor', () => {
    const files = cssModules(resolve(process.cwd(), 'src'))
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      expect(literalColors(readFileSync(file, 'utf8')), file).toEqual([])
    }
  })
})
