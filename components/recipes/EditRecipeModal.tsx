'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Minus, Loader2 } from 'lucide-react'
import { CUISINES, MAIN_INGREDIENTS, DIFFICULTIES } from '@/lib/utils'

interface Ingredient { quantity: string; unit: string; item: string }

interface Recipe {
  id: string
  name: string
  image_url: string | null
  source_url: string | null
  cuisine: string | null
  main_ingredient: string | null
  difficulty: string | null
  time_minutes: number | null
  ingredients: Ingredient[]
  directions: string[]
}

interface Props {
  recipe: Recipe
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function EditRecipeModal({ recipe, open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [mainIngredient, setMainIngredient] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [timeMinutes, setTimeMinutes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [directions, setDirections] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(recipe.name)
      setImageUrl(recipe.image_url ?? '')
      setSourceUrl(recipe.source_url ?? '')
      setCuisine(recipe.cuisine ?? '')
      setMainIngredient(recipe.main_ingredient ?? '')
      setDifficulty(recipe.difficulty ?? '')
      setTimeMinutes(recipe.time_minutes?.toString() ?? '')
      setIngredients(recipe.ingredients.length ? recipe.ingredients : [{ quantity: '', unit: '', item: '' }])
      setDirections(recipe.directions.length ? recipe.directions : [''])
    }
  }, [open, recipe])

  async function handleSave() {
    if (!name.trim()) { toast.error('Recipe name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('recipes').update({
      name: name.trim(),
      image_url: imageUrl.trim() || null,
      source_url: sourceUrl.trim() || null,
      cuisine: cuisine || null,
      main_ingredient: mainIngredient || null,
      difficulty: difficulty || null,
      time_minutes: timeMinutes ? parseInt(timeMinutes) : null,
      ingredients: ingredients.filter(i => i.item.trim()),
      directions: directions.filter(d => d.trim()),
    }).eq('id', recipe.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Recipe updated!')
    onSaved()
    onClose()
  }

  const label = 'block text-xs font-medium text-gray-600 mb-1'
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] focus:border-transparent'
  const sel = `${input} bg-white`

  return (
    <Modal open={open} onClose={onClose} title="Edit Recipe" className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Recipe Name *</label>
            <input className={input} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Image URL</label>
            <input className={input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
          </div>
          <div>
            <label className={label}>Source URL</label>
            <input className={input} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
          </div>
          <div>
            <label className={label}>Cuisine</label>
            <select className={sel} value={cuisine} onChange={e => setCuisine(e.target.value)}>
              <option value="">Select...</option>
              {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Main Ingredient</label>
            <select className={sel} value={mainIngredient} onChange={e => setMainIngredient(e.target.value)}>
              <option value="">Select...</option>
              {MAIN_INGREDIENTS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Difficulty</label>
            <select className={sel} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="">Select...</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Time (minutes)</label>
            <input type="number" className={input} value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)} min={0} />
          </div>
        </div>

        <div>
          <label className={`${label} mb-2`}>Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={`${input} w-16 shrink-0`} placeholder="Qty" value={ing.quantity} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                <input className={`${input} w-20 shrink-0`} placeholder="Unit" value={ing.unit} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                <input className={`${input} flex-1`} placeholder="Ingredient" value={ing.item} onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                  <Minus size={14} />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2 text-[#E07B39]" onClick={() => setIngredients(prev => [...prev, { quantity: '', unit: '', item: '' }])}>
            <Plus size={14} /> Add ingredient
          </Button>
        </div>

        <div>
          <label className={`${label} mb-2`}>Directions</label>
          <div className="space-y-2">
            {directions.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs text-gray-400 font-medium mt-2.5 w-5 shrink-0">{i + 1}.</span>
                <textarea
                  className={`${input} flex-1 resize-none`}
                  rows={2}
                  value={step}
                  onChange={e => setDirections(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                />
                <Button variant="ghost" size="icon" onClick={() => setDirections(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 hover:bg-red-50 mt-0.5 shrink-0">
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
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  )
}
