import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

interface ScrapedRecipe {
  name: string
  imageUrl: string
  ingredients: { quantity: string; unit: string; item: string }[]
  directions: string[]
  sourceUrl: string
}

function parseIngredientText(text: string): { quantity: string; unit: string; item: string } {
  const units = ['cup','cups','tbsp','tsp','tablespoon','tablespoons','teaspoon','teaspoons',
    'oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams','kg','ml','liter',
    'liters','l','clove','cloves','bunch','bunches','can','cans','pkg','package','slice','slices',
    'piece','pieces','dash','pinch','handful','medium','large','small']
  const unitRe = new RegExp(`^(\\d[\\d/\\s\\u00BC-\\u00BE\\u2150-\\u215E]*)\\s+(${units.join('|')})s?\\s+(.+)`, 'i')
  const qtyRe = /^(\d[\d/\s¼-¾⅐-⅞]*)\s+(.+)/
  const mU = text.match(unitRe)
  if (mU) return { quantity: mU[1].trim(), unit: mU[2].trim(), item: mU[3].trim() }
  const mQ = text.match(qtyRe)
  if (mQ) return { quantity: mQ[1].trim(), unit: '', item: mQ[2].trim() }
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

function normalizeStep(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    if (r.text) return String(r.text).trim()
    if (r.name) return String(r.name).trim()
  }
  return String(raw).trim()
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

  return {
    name: String(recipe['name'] ?? '').trim(),
    imageUrl,
    ingredients: rawIngredients.map(normalizeIngredient).filter(i => i.item),
    directions: rawSteps.map(normalizeStep).filter(Boolean),
  }
}

function extractHeuristic(html: string, url: string): Partial<ScrapedRecipe> {
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

  const result: ScrapedRecipe = {
    name: jsonLd?.name || heuristic.name || '',
    imageUrl: jsonLd?.imageUrl || heuristic.imageUrl || '',
    ingredients: (jsonLd?.ingredients?.length ? jsonLd.ingredients : heuristic.ingredients) ?? [],
    directions: (jsonLd?.directions?.length ? jsonLd.directions : heuristic.directions) ?? [],
    sourceUrl: url,
  }

  return NextResponse.json(result)
}
