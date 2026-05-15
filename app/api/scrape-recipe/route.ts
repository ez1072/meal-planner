import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

interface ScrapedRecipe {
  name: string
  imageUrl: string
  ingredients: { quantity: string; unit: string; item: string }[]
  directions: string[]
  sourceUrl: string
  timeMinutes: number | null
  mainIngredient: string | null
  cookType: string | null
}

const COOK_TYPE_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'Air Fryer', keywords: ['air fryer', 'air-fryer', 'airfryer'] },
  { category: 'Crockpot',  keywords: ['crockpot', 'crock pot', 'crock-pot', 'slow cooker', 'slow-cooker'] },
  { category: 'Oven',      keywords: ['baked', 'bake', 'roasted', 'roast', 'oven', 'sheet pan', 'sheet-pan', 'broiled', 'broil'] },
  { category: 'Pan',       keywords: ['pan', 'skillet', 'stovetop', 'stove top', 'sauté', 'saute', 'pan-seared', 'pan seared', 'stir fry', 'stir-fry', 'wok', 'sauteed'] },
]

function inferCookType(name: string): string | null {
  const lower = name.toLowerCase()
  for (const { category, keywords } of COOK_TYPE_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return category
  }
  return null
}

const INGREDIENT_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'Salmon',      keywords: ['salmon', 'smoked salmon'] },
  { category: 'Shrimp',      keywords: ['shrimp', 'prawn', 'prawns', 'scampi'] },
  { category: 'Steak',       keywords: ['steak', 'ribeye', 'sirloin', 'flank steak', 'skirt steak', 't-bone', 'porterhouse'] },
  { category: 'Beef',        keywords: ['beef', 'ground beef', 'brisket', 'chuck', 'pot roast', 'meatball', 'meatballs', 'hamburger'] },
  { category: 'Chicken',     keywords: ['chicken', 'rotisserie chicken', 'turkey', 'poultry'] },
  { category: 'Pasta',       keywords: ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'rigatoni', 'lasagna', 'lasagne', 'noodle', 'noodles', 'orzo', 'gnocchi', 'ravioli', 'tortellini', 'macaroni'] },
  { category: 'Vegetarian',  keywords: ['tofu', 'tempeh', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'falafel', 'veggie', 'vegetarian', 'vegan'] },
]

function inferMainIngredient(name: string, ingredients: { item: string }[]): string | null {
  const haystack = [name, ...ingredients.map(i => i.item)].join(' ').toLowerCase()
  for (const { category, keywords } of INGREDIENT_KEYWORDS) {
    if (keywords.some(kw => haystack.includes(kw))) return category
  }
  return null
}

// Parses ISO 8601 duration strings like "PT30M", "PT1H30M", "P0DT0H17M0S"
function parseIsoDuration(raw: unknown): number | null {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  const days = parseInt(m[1] ?? '0')
  const hours = parseInt(m[2] ?? '0')
  const mins = parseInt(m[3] ?? '0')
  const total = days * 1440 + hours * 60 + mins
  return total > 0 ? total : null
}

function parseIngredientText(text: string): { quantity: string; unit: string; item: string } {
  // Normalise: replace vulgar fractions and "½" style chars with ascii equivalents for parsing,
  // but keep the original string for the qty value so display looks nice.
  const normalized = text
    .replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3').replace(/⅔/g, '2/3')
    .replace(/⅕/g, '1/5').replace(/⅖/g, '2/5').replace(/⅗/g, '3/5').replace(/⅘/g, '4/5')
    .replace(/⅙/g, '1/6').replace(/⅚/g, '5/6')
    .replace(/⅐/g, '1/7').replace(/⅛/g, '1/8').replace(/⅜/g, '3/8')
    .replace(/⅝/g, '5/8').replace(/⅞/g, '7/8')
    .replace(/(\d)\s+(\d\/\d)/g, '$1 $2') // "1 1/2" → keep as-is

  const units = ['cups','cup','tablespoons','tablespoon','tbsp','teaspoons','teaspoon','tsp',
    'ounces','ounce','oz','pounds','pound','lbs','lb','grams','gram','kg','g','ml','liters','liter','l',
    'cloves','clove','bunches','bunch','cans','can','packages','package','pkg',
    'slices','slice','pieces','piece','dash','pinch','handful','medium','large','small']

  // qty + unit + item  (handles "1 1/2 cups flour", "1/2 cup milk", "2 tablespoons oil")
  const unitRe = new RegExp(`^([\\d/\\s]+(?:\\d/\\d)?)\\s+(${units.join('|')})s?\\b\\s*(.+)`, 'i')
  // qty + item only  (handles "4 salmon fillets")
  const qtyRe = /^([\d/]+(?:\s+\d\/\d)?)\s+(.+)/

  const mU = normalized.match(unitRe)
  if (mU) {
    const qty = mU[1].trim()
    // recover original fraction chars for the quantity portion
    const originalQty = text.slice(0, text.length - normalized.length + qty.length)
    return { quantity: originalQty.trim() || qty, unit: mU[2].trim(), item: mU[3].trim() }
  }
  const mQ = normalized.match(qtyRe)
  if (mQ) {
    const qty = mQ[1].trim()
    const originalQty = text.slice(0, text.length - normalized.length + qty.length)
    return { quantity: originalQty.trim() || qty, unit: '', item: mQ[2].trim() }
  }
  return { quantity: '', unit: '', item: text.trim() }
}

function normalizeIngredient(raw: unknown): { quantity: string; unit: string; item: string } {
  if (typeof raw === 'string') return parseIngredientText(raw)
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    // HowToSupply / schema.org ingredient object
    if (r.name) return parseIngredientText(String(r.name))
    if (r.item) return parseIngredientText(String(r.item))
  }
  return { quantity: '', unit: '', item: String(raw) }
}

// Flattens a single instruction item into one or more step strings.
// Handles HowToStep (text), HowToSection (itemListElement with nested steps), and plain strings.
function flattenStep(raw: unknown): string[] {
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t ? [t] : []
  }
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    const type = String(r['@type'] ?? '').toLowerCase()

    // HowToSection — recurse into itemListElement
    if (type === 'howtosection' || Array.isArray(r.itemListElement)) {
      const children = Array.isArray(r.itemListElement) ? r.itemListElement : []
      return children.flatMap(flattenStep).filter(Boolean)
    }

    // HowToStep or plain object
    if (r.text) return [String(r.text).trim()]
    if (r.name) return [String(r.name).trim()]
  }
  return []
}

function extractFromJsonLd(html: string): Partial<ScrapedRecipe> | null {
  const $ = cheerio.load(html)
  let recipe: Record<string, unknown> | null = null

  $('script[type="application/ld+json"]').each((_, el) => {
    if (recipe) return
    try {
      const data = JSON.parse($(el).html() ?? '')
      const candidates: unknown[] = Array.isArray(data) ? data : [data]
      for (const node of candidates) {
        if (!node || typeof node !== 'object') continue
        const n = node as Record<string, unknown>
        if (String(n['@type'] ?? '').toLowerCase().includes('recipe')) {
          recipe = n; break
        }
        // @graph
        if (Array.isArray(n['@graph'])) {
          for (const g of n['@graph'] as unknown[]) {
            if (g && typeof g === 'object') {
              const gn = g as Record<string, unknown>
              if (String(gn['@type'] ?? '').toLowerCase().includes('recipe')) {
                recipe = gn; break
              }
            }
          }
        }
      }
    } catch {}
  })

  if (!recipe) return null

  const rawIngredients = (recipe['recipeIngredient'] as unknown[]) ?? []
  const rawSteps = (recipe['recipeInstructions'] as unknown[]) ?? []

  const image = recipe['image']
  let imageUrl = ''
  if (typeof image === 'string') imageUrl = image
  else if (Array.isArray(image) && image[0]) imageUrl = String(image[0])
  else if (image && typeof image === 'object') imageUrl = String((image as Record<string,unknown>).url ?? '')

  const cookPlusPrep = (parseIsoDuration(recipe['cookTime']) ?? 0) + (parseIsoDuration(recipe['prepTime']) ?? 0)
  const timeMinutes = parseIsoDuration(recipe['totalTime']) ?? (cookPlusPrep > 0 ? cookPlusPrep : null)

  return {
    name: String(recipe['name'] ?? '').trim(),
    imageUrl,
    ingredients: rawIngredients.map(normalizeIngredient).filter(i => i.item),
    directions: rawSteps.flatMap(flattenStep).filter(Boolean),
    timeMinutes,
  }
}

function extractHeuristic(html: string, _url: string): Partial<ScrapedRecipe> {
  const $ = cheerio.load(html)

  const name =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    ''

  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('img[class*="hero"]').first().attr('src') ||
    $('img[class*="recipe"]').first().attr('src') ||
    ''

  const ingredientSelectors = [
    '[class*="ingredient"] li',
    '[class*="ingredients"] li',
    '[id*="ingredient"] li',
    '.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li',
    '[data-ingredient]',
  ]
  const ingredients: { quantity: string; unit: string; item: string }[] = []
  for (const sel of ingredientSelectors) {
    const found = $(sel)
    if (found.length > 0) {
      found.each((_, el) => {
        const text = $(el).text().trim()
        if (text) ingredients.push(parseIngredientText(text))
      })
      break
    }
  }

  const stepSelectors = [
    '[class*="instruction"] li',
    '[class*="instructions"] li',
    '[class*="direction"] li',
    '[class*="directions"] li',
    '[class*="step"] li',
    '.wprm-recipe-instruction-text',
    '.tasty-recipes-instructions li',
  ]
  const directions: string[] = []
  for (const sel of stepSelectors) {
    const found = $(sel)
    if (found.length > 0) {
      found.each((_, el) => {
        const text = $(el).text().trim()
        if (text) directions.push(text)
      })
      break
    }
  }

  return { name, imageUrl, ingredients, directions }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({}))
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MealPlannerBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch URL: ${String(err)}` }, { status: 422 })
  }

  const jsonLd = extractFromJsonLd(html)
  const heuristic = extractHeuristic(html, url)

  const name = jsonLd?.name || heuristic.name || ''
  const ingredients = (jsonLd?.ingredients?.length ? jsonLd.ingredients : heuristic.ingredients) ?? []

  const result: ScrapedRecipe = {
    name,
    imageUrl: jsonLd?.imageUrl || heuristic.imageUrl || '',
    ingredients,
    directions: (jsonLd?.directions?.length ? jsonLd.directions : heuristic.directions) ?? [],
    timeMinutes: jsonLd?.timeMinutes ?? null,
    mainIngredient: inferMainIngredient(name, ingredients),
    cookType: inferCookType(name),
    sourceUrl: url,
  }

  return NextResponse.json(result)
}
