'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SlotModal from '@/components/planner/SlotModal'
import {
  ChevronLeft, ChevronRight, Sparkles, ShoppingCart, Copy, X, Plus, ChefHat, Loader2
} from 'lucide-react'
import { DAYS_OF_WEEK, addDays, formatDateToYMD, getMonday } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface Recipe {
  id: string
  name: string
  image_url: string | null
  ingredients: { quantity: string; unit: string; item: string }[]
  cuisine: string | null
  main_ingredient: string | null
}

interface MealSlot {
  id: string
  day_of_week: string
  meal_type: 'lunch' | 'dinner'
  recipe_id: string | null
  custom_label: string | null
  recipe?: Recipe | null
}

interface IngredientEntry {
  quantity: string; unit: string; item: string; recipeName: string
}

interface Suggestion {
  recipe: Recipe
  sharedIngredients: string[]
  sharedWith: string[]   // names of planned recipes (or other library recipes) that share those ingredients
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState<string>(() => formatDateToYMD(getMonday(new Date())))
  const [slots, setSlots] = useState<MealSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeDay, setActiveDay] = useState('')
  const [activeMeal, setActiveMeal] = useState<'lunch' | 'dinner'>('dinner')
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null)
  const [showSmartPanel, setShowSmartPanel] = useState(false)
  const [showShoppingPanel, setShowShoppingPanel] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [pantryNames, setPantryNames] = useState<string[]>([])

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('meal_plan')
      .select('id,day_of_week,meal_type,recipe_id,custom_label,recipe:recipes(id,name,image_url,ingredients,cuisine,main_ingredient)')
      .eq('week_start', weekStart)
    const mapped: MealSlot[] = (data ?? []).map((s) => ({
      ...s,
      recipe: Array.isArray(s.recipe) ? (s.recipe[0] ?? null) : (s.recipe ?? null),
    })) as MealSlot[]
    setSlots(mapped)
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  function prevWeek() { setWeekStart(formatDateToYMD(addDays(new Date(weekStart + 'T12:00:00'), -7))) }
  function nextWeek() { setWeekStart(formatDateToYMD(addDays(new Date(weekStart + 'T12:00:00'), 7))) }
  function goToday() { setWeekStart(formatDateToYMD(getMonday(new Date()))) }

  function openSlotModal(day: string, meal: 'lunch' | 'dinner') {
    const slot = slots.find(s => s.day_of_week === day && s.meal_type === meal) ?? null
    setActiveDay(day)
    setActiveMeal(meal)
    setActiveSlot(slot)
    setModalOpen(true)
  }

  const weekLabel = (() => {
    const start = new Date(weekStart + 'T12:00:00')
    const end = addDays(start, 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`
  })()

  async function removeSlot(slotId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('meal_plan').delete().eq('id', slotId)
    if (error) { toast.error(error.message); return }
    toast.success('Meal removed')
    fetchSlots()
  }

  // All recipes used this week
  const weekRecipes = slots.map(s => s.recipe).filter(Boolean) as Recipe[]

  async function computeSuggestions() {
    setLoadingSuggestions(true)
    const supabase = createClient()
    const { data: allRecipes } = await supabase
      .from('recipes')
      .select('id,name,image_url,ingredients,cuisine,main_ingredient')
    if (!allRecipes) { setLoadingSuggestions(false); return }

    const plannedIds = new Set(weekRecipes.map(r => r.id))
    const plannedIngredients = new Set(
      weekRecipes.flatMap(r => (r.ingredients ?? []).map(i => i.item.toLowerCase().trim())).filter(Boolean)
    )

    const libraryRecipes = allRecipes as Recipe[]

    let results: Suggestion[]

    if (plannedIngredients.size > 0) {
      // Plan has meals — suggest unplanned recipes with the most overlap
      results = libraryRecipes
        .filter(r => !plannedIds.has(r.id))
        .map(r => {
          const shared: string[] = []
          const sharedWithNames = new Set<string>()
          for (const ing of r.ingredients ?? []) {
            const key = ing.item.toLowerCase().trim()
            if (!key) continue
            if (plannedIngredients.has(key)) {
              shared.push(ing.item)
              // find which planned recipe(s) use this ingredient
              for (const pr of weekRecipes) {
                if ((pr.ingredients ?? []).some(pi => pi.item.toLowerCase().trim() === key)) {
                  sharedWithNames.add(pr.name)
                }
              }
            }
          }
          return { recipe: r, sharedIngredients: shared, sharedWith: [...sharedWithNames] }
        })
        .filter(s => s.sharedIngredients.length > 0)
        .sort((a, b) => b.sharedIngredients.length - a.sharedIngredients.length)
        .slice(0, 8)
    } else {
      // Empty plan — find recipe pairs with the most shared ingredients
      const scored = libraryRecipes.map(r => {
        const rKeys = new Set((r.ingredients ?? []).map(i => i.item.toLowerCase().trim()).filter(Boolean))
        let totalShared = 0
        let bestPartner: Recipe | null = null
        let bestShared: string[] = []
        for (const other of libraryRecipes) {
          if (other.id === r.id) continue
          const shared = (other.ingredients ?? [])
            .map(i => i.item.toLowerCase().trim())
            .filter(k => k && rKeys.has(k))
          if (shared.length > bestShared.length) {
            bestShared = shared
            bestPartner = other
          }
          totalShared += shared.length
        }
        return { recipe: r, totalShared, bestShared, bestPartner }
      })
      .filter(s => s.bestShared.length > 0)
      .sort((a, b) => b.totalShared - a.totalShared)
      .slice(0, 8)

      results = scored.map(s => ({
        recipe: s.recipe,
        sharedIngredients: s.bestShared,
        sharedWith: s.bestPartner ? [s.bestPartner.name] : [],
      }))
    }

    setSuggestions(results)
    setLoadingSuggestions(false)
  }

  // Shopping list — deduplicated, filtered against pantry
  const { shoppingList, inPantryCount } = (() => {
    const seen = new Set<string>()
    const shoppingList: IngredientEntry[] = []
    let inPantryCount = 0
    for (const r of weekRecipes) {
      for (const ing of r.ingredients ?? []) {
        const key = ing.item?.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        const inPantry = pantryNames.some(p => p.includes(key) || key.includes(p))
        if (inPantry) { inPantryCount++; continue }
        shoppingList.push({ ...ing, recipeName: r.name })
      }
    }
    return { shoppingList, inPantryCount }
  })()

  function copyShoppingList() {
    if (shoppingList.length === 0) { toast.error('No ingredients to copy'); return }
    const text = shoppingList
      .map(i => `- ${[i.quantity, i.unit, i.item].filter(Boolean).join(' ')}`)
      .join('\n')
    navigator.clipboard.writeText(`Shopping list for week of ${weekStart}:\n\n${text}`)
    toast.success('Shopping list copied to clipboard!')
  }

  const today = new Date()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Planner</h1>
          <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Today</button>
          <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight size={16} /></button>
          <Button variant="outline" onClick={() => {
            const opening = !showSmartPanel
            setShowSmartPanel(opening)
            setShowShoppingPanel(false)
            if (opening) { setSuggestions([]); computeSuggestions() }
          }}>
            <Sparkles size={15} /> Smart Suggestions
          </Button>
          <Button variant="outline" onClick={async () => {
            const opening = !showShoppingPanel
            setShowShoppingPanel(opening)
            setShowSmartPanel(false)
            if (opening) {
              const supabase = createClient()
              const { data } = await supabase.from('pantry').select('item_name')
              setPantryNames((data ?? []).map((p: { item_name: string }) => p.item_name.toLowerCase()))
            }
          }}>
            <ShoppingCart size={15} /> Shopping List
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="space-y-2">
                  <div className="h-6 bg-gray-100 rounded animate-pulse" />
                  <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day, idx) => {
                const date = addDays(new Date(weekStart + 'T12:00:00'), idx)
                const isToday = formatDateToYMD(date) === formatDateToYMD(today)

                return (
                  <div key={day} className="space-y-2">
                    <div className={`text-center text-xs font-semibold pb-1 border-b ${isToday ? 'text-[#E07B39] border-[#E07B39]' : 'text-gray-500 border-gray-200'}`}>
                      <div>{day.slice(0, 3)}</div>
                      <div className={`text-sm font-bold ${isToday ? 'text-[#E07B39]' : 'text-gray-700'}`}>{date.getDate()}</div>
                    </div>
                    {(['lunch', 'dinner'] as const).map(meal => {
                      const slot = slots.find(s => s.day_of_week === day && s.meal_type === meal)
                      return slot ? (
                        <div key={meal} className="relative group rounded-xl border bg-white border-gray-200 shadow-sm hover:shadow transition-all">
                          <button
                            onClick={() => openSlotModal(day, meal)}
                            className="w-full text-left p-2"
                          >
                            <Badge label={meal} className="mb-1.5 text-[10px]" />
                            <div className="space-y-1">
                              {slot.recipe?.image_url && (
                                <div className="h-12 rounded-lg overflow-hidden bg-gray-100">
                                  <img src={slot.recipe.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2 pr-4">
                                {slot.recipe?.name ?? slot.custom_label}
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); removeSlot(slot.id) }}
                            className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 text-gray-400 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={meal}
                          onClick={() => openSlotModal(day, meal)}
                          className="w-full text-left rounded-xl border border-dashed border-gray-200 hover:border-[#E07B39] hover:bg-orange-50 transition-all group"
                        >
                          <div className="p-2">
                            <Badge label={meal} className="mb-1.5 text-[10px]" />
                            <div className="flex items-center justify-center h-10 text-gray-300 group-hover:text-[#E07B39]">
                              <Plus size={16} />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Smart Suggestions panel */}
        {showSmartPanel && (
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 self-start">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Sparkles size={14} className="text-[#E07B39]" /> Smart Suggestions</h3>
              <button onClick={() => setShowSmartPanel(false)} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              {weekRecipes.length > 0 ? 'Recipes that reuse ingredients already in your plan' : 'Recipes that pair well together'}
            </p>
            {loadingSuggestions ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No suggestions found. Add more recipes to your library.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {suggestions.map(s => (
                  <Link key={s.recipe.id} href={`/recipes/${s.recipe.id}`} className="flex gap-2.5 p-2 rounded-xl hover:bg-orange-50 transition-colors group">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {s.recipe.image_url
                        ? <img src={s.recipe.image_url} alt={s.recipe.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ChefHat size={14} className="text-gray-300" /></div>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-snug truncate group-hover:text-[#E07B39]">{s.recipe.name}</p>
                      <p className="text-[10px] text-[#4A7C59] font-medium mt-0.5">
                        {s.sharedIngredients.length} shared ingredient{s.sharedIngredients.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {s.sharedIngredients.slice(0, 3).join(', ')}{s.sharedIngredients.length > 3 ? '…' : ''}
                      </p>
                      {s.sharedWith.length > 0 && (
                        <p className="text-[10px] text-gray-400 truncate">with {s.sharedWith[0]}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shopping List panel */}
        {showShoppingPanel && (
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 self-start">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><ShoppingCart size={14} className="text-[#E07B39]" /> Shopping List</h3>
              <button onClick={() => setShowShoppingPanel(false)} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
            </div>
            {inPantryCount > 0 && (
              <p className="text-[11px] text-[#4A7C59] mb-3">{inPantryCount} ingredient{inPantryCount !== 1 ? 's' : ''} already in your pantry — excluded</p>
            )}
            {shoppingList.length === 0 && inPantryCount === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Add recipes with ingredients to generate your shopping list.</p>
            ) : shoppingList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">You already have everything in your pantry!</p>
            ) : (
              <>
                <ul className="space-y-1.5 mb-4 max-h-96 overflow-y-auto">
                  {shoppingList.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-[#E07B39] shrink-0 mt-0.5">•</span>
                      <span>{[ing.quantity, ing.unit, ing.item].filter(Boolean).join(' ')}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={copyShoppingList} className="w-full" size="sm">
                  <Copy size={13} /> Copy to Clipboard
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {weekRecipes.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">This Week&apos;s Meals</h2>
          <div className="flex flex-wrap gap-2">
            {weekRecipes.map((r, i) => (
              <Link key={i} href={`/recipes/${r.id}`} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 hover:bg-orange-50 transition-colors">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center"><ChefHat size={12} className="text-orange-400" /></div>
                )}
                <span className="text-xs font-medium text-gray-700">{r.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <SlotModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        weekStart={weekStart}
        dayOfWeek={activeDay}
        mealType={activeMeal}
        existing={activeSlot}
        onSaved={fetchSlots}
      />
    </div>
  )
}
