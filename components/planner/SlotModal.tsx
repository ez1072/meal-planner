'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Search, ChefHat } from 'lucide-react'

interface Recipe { id: string; name: string; image_url: string | null }
interface MealSlot {
  id?: string
  recipe_id?: string | null
  custom_label?: string | null
  recipe?: Recipe | null
}

interface Props {
  open: boolean
  onClose: () => void
  weekStart: string
  dayOfWeek: string
  mealType: 'lunch' | 'dinner'
  existing: MealSlot | null
  onSaved: () => void
}

export default function SlotModal({ open, onClose, weekStart, dayOfWeek, mealType, existing, onSaved }: Props) {
  const [mode, setMode] = useState<'view' | 'pick'>('pick')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipeSearch, setRecipeSearch] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(existing ? 'view' : 'pick')
      setSelectedRecipeId(null)
      setCustomLabel('')
      setRecipeSearch('')
      loadRecipes()
    }
  }, [open, existing])

  async function loadRecipes() {
    const supabase = createClient()
    const { data } = await supabase.from('recipes').select('id,name,image_url').order('name')
    setRecipes(data ?? [])
  }

  async function handleSave() {
    if (!selectedRecipeId && !customLabel.trim()) {
      toast.error('Select a recipe or enter a custom label')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      week_start: weekStart,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      recipe_id: selectedRecipeId ?? null,
      custom_label: selectedRecipeId ? null : customLabel.trim(),
    }
    const { error } = await supabase.from('meal_plan').upsert(payload, { onConflict: 'week_start,day_of_week,meal_type' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Meal saved!')
    onSaved()
    onClose()
  }

  async function handleRemove() {
    if (!existing?.id) return
    setRemoving(true)
    const supabase = createClient()
    const { error } = await supabase.from('meal_plan').delete().eq('id', existing.id)
    setRemoving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Meal removed')
    onSaved()
    onClose()
  }

  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(recipeSearch.toLowerCase()))

  const title = `${dayOfWeek} — ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`

  if (mode === 'view' && existing) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <div className="space-y-4">
          {existing.recipe?.image_url && (
            <div className="h-36 rounded-xl overflow-hidden bg-gray-100">
              <img src={existing.recipe.image_url} alt={existing.recipe.name} className="w-full h-full object-cover" />
            </div>
          )}
          <p className="font-semibold text-gray-800 text-base">{existing.recipe?.name ?? existing.custom_label}</p>
          <div className="flex gap-2">
            {existing.recipe_id && (
              <Button variant="accent" size="sm" onClick={() => { onClose(); window.location.href = `/recipes/${existing.recipe_id}` }}>
                View Recipe
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setMode('pick')}>Change</Button>
            <Button variant="destructive" size="sm" onClick={handleRemove} disabled={removing}>
              {removing ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-lg">
      <div className="space-y-4">
        {/* Recipe search */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Select a recipe</p>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39]"
              placeholder="Search recipes..."
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
            {filteredRecipes.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No recipes found</p>
            ) : filteredRecipes.map(r => (
              <button
                key={r.id}
                onClick={() => { setSelectedRecipeId(r.id); setCustomLabel('') }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-orange-50 ${selectedRecipeId === r.id ? 'bg-orange-50' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {r.image_url ? <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ChefHat size={16} className="text-gray-300" /></div>}
                </div>
                <span className="font-medium text-gray-800 truncate">{r.name}</span>
                {selectedRecipeId === r.id && <span className="ml-auto text-[#E07B39] text-xs font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Custom label</p>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39]"
            placeholder="e.g. Restaurant, Leftovers, Eating out..."
            value={customLabel}
            onChange={e => { setCustomLabel(e.target.value); if (e.target.value) setSelectedRecipeId(null) }}
          />
        </div>

        <div className="flex gap-2">
          {existing && <Button variant="outline" size="sm" onClick={() => setMode('view')}>Cancel</Button>}
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
