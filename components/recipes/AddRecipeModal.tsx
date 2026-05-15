'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Minus, Loader2, Link2 } from 'lucide-react'
import { CUISINES, MAIN_INGREDIENTS, DIFFICULTIES } from '@/lib/utils'

interface Ingredient { quantity: string; unit: string; item: string }

const emptyIngredient = (): Ingredient => ({ quantity: '', unit: '', item: '' })

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function AddRecipeModal({ open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'url' | 'manual'>('url')
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [mainIngredient, setMainIngredient] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [timeMinutes, setTimeMinutes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()])
  const [directions, setDirections] = useState<string[]>([''])

  function reset() {
    setTab('url'); setScrapeUrl(''); setName(''); setImageUrl(''); setSourceUrl('')
    setCuisine(''); setMainIngredient(''); setDifficulty(''); setTimeMinutes('')
    setIngredients([emptyIngredient()]); setDirections([''])
  }

  async function handleScrape() {
    if (!scrapeUrl) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
      setName(data.name ?? '')
      setImageUrl(data.imageUrl ?? '')
      setSourceUrl(data.sourceUrl ?? scrapeUrl)
      setIngredients(data.ingredients?.length ? data.ingredients : [emptyIngredient()])
      setDirections(data.directions?.length ? data.directions : [''])
      setTab('manual')
      toast.success('Recipe scraped — review and save')
    } catch (e: unknown) {
      toast.error(String(e instanceof Error ? e.message : e))
    } finally {
      setScraping(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Recipe name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('recipes').insert({
      name: name.trim(),
      image_url: imageUrl.trim() || null,
      source_url: sourceUrl.trim() || null,
      cuisine: cuisine || null,
      main_ingredient: mainIngredient || null,
      difficulty: difficulty || null,
      time_minutes: timeMinutes ? parseInt(timeMinutes) : null,
      ingredients: ingredients.filter(i => i.item.trim()),
      directions: directions.filter(d => d.trim()),
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Recipe saved!')
    reset()
    onSaved()
    onClose()
  }

  const label = 'block text-xs font-medium text-gray-600 mb-1'
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] focus:border-transparent'
  const select = `${input} bg-white`

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Add Recipe" className="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-lg">
        {(['url', 'manual'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'url' ? '🔗 Scrape from URL' : '✏️ Manual Entry'}
          </button>
        ))}
      </div>

      {tab === 'url' && (
        <div className="space-y-4">
          <div>
            <label className={label}>Recipe URL</label>
            <input
              type="url"
              className={input}
              placeholder="https://www.allrecipes.com/recipe/..."
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
            />
          </div>
          <Button onClick={handleScrape} disabled={!scrapeUrl || scraping} className="w-full">
            {scraping ? <><Loader2 size={16} className="animate-spin" /> Scraping...</> : <><Link2 size={16} /> Scrape Recipe</>}
          </Button>
          <p className="text-xs text-gray-400 text-center">Works best with sites that use schema.org Recipe markup (AllRecipes, NYT Cooking, etc.)</p>
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>Recipe Name *</label>
              <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Tikka Masala" />
            </div>
            <div>
              <label className={label}>Image URL</label>
              <input className={input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={label}>Source URL</label>
              <input className={input} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={label}>Cuisine</label>
              <select className={select} value={cuisine} onChange={e => setCuisine(e.target.value)}>
                <option value="">Select...</option>
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Main Ingredient</label>
              <select className={select} value={mainIngredient} onChange={e => setMainIngredient(e.target.value)}>
                <option value="">Select...</option>
                {MAIN_INGREDIENTS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Difficulty</label>
              <select className={select} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="">Select...</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Time (minutes)</label>
              <input type="number" className={input} value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)} placeholder="30" min={0} />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <label className={`${label} mb-2`}>Ingredients</label>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={`${input} w-16 shrink-0`} placeholder="Qty" value={ing.quantity} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                  <input className={`${input} w-20 shrink-0`} placeholder="Unit" value={ing.unit} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                  <input className={`${input} flex-1`} placeholder="Ingredient" value={ing.item} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))} className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Minus size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-[#E07B39]" onClick={() => setIngredients(prev => [...prev, emptyIngredient()])}>
              <Plus size={14} /> Add ingredient
            </Button>
          </div>

          {/* Directions */}
          <div>
            <label className={`${label} mb-2`}>Directions</label>
            <div className="space-y-2">
              {directions.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 font-medium mt-2.5 w-5 shrink-0">{i + 1}.</span>
                  <textarea
                    className={`${input} flex-1 resize-none`}
                    rows={2}
                    placeholder={`Step ${i + 1}`}
                    value={step}
                    onChange={e => setDirections(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setDirections(prev => prev.filter((_, j) => j !== i))} className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 mt-0.5">
                    <Minus size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-[#E07B39]" onClick={() => setDirections(prev => [...prev, ''])}>
              <Plus size={14} /> Add step
            </Button>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Recipe'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
