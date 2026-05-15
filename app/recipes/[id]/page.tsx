'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, ExternalLink, ArrowLeft, Pencil, Trash2, CalendarPlus, ChefHat } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import EditRecipeModal from '@/components/recipes/EditRecipeModal'
import AddToPlanModal from '@/components/recipes/AddToPlanModal'
import { formatTime } from '@/lib/utils'

interface Ingredient { quantity: string; unit: string; item: string }
interface Recipe {
  id: string
  name: string
  image_url: string | null
  source_url: string | null
  cuisine: string | null
  main_ingredient: string | null
  difficulty: string | null
  cook_type: string | null
  time_minutes: number | null
  ingredients: Ingredient[]
  directions: string[]
}

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showAddToPlan, setShowAddToPlan] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function fetchRecipe() {
    const supabase = createClient()
    const { data } = await supabase.from('recipes').select('*').eq('id', id).single()
    setRecipe(data)
    setLoading(false)
  }

  useEffect(() => { fetchRecipe() }, [id])

  async function handleDelete() {
    if (!confirm('Delete this recipe? This cannot be undone.')) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) { toast.error(error.message); setDeleting(false); return }
    toast.success('Recipe deleted')
    router.push('/recipes')
  }

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="h-64 bg-gray-100 rounded-2xl" />
      <div className="h-8 bg-gray-100 rounded w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
    </div>
  )

  if (!recipe) return (
    <div className="p-6 max-w-3xl mx-auto text-center py-24">
      <p className="text-gray-500">Recipe not found.</p>
      <Link href="/recipes" className="text-[#E07B39] text-sm mt-2 inline-block hover:underline">← Back to Recipes</Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Recipes
      </Link>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden mb-6 bg-gray-100 h-56 sm:h-72 relative">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-orange-50">
            <ChefHat size={56} className="text-orange-200" />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{recipe.name}</h1>
          <div className="flex flex-wrap gap-2 items-center">
            {recipe.cuisine && <Badge label={recipe.cuisine} />}
            {recipe.difficulty && <Badge label={recipe.difficulty} />}
            {recipe.cook_type && <Badge label={recipe.cook_type} colorKey="cookType" />}
            {recipe.main_ingredient && <span className="text-xs text-gray-500">{recipe.main_ingredient}</span>}
            {recipe.time_minutes && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} /> {formatTime(recipe.time_minutes)}
              </span>
            )}
          </div>
          {recipe.source_url && (
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#E07B39] hover:underline mt-2">
              <ExternalLink size={12} /> View original recipe
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" onClick={() => setShowAddToPlan(true)}>
            <CalendarPlus size={15} /> Add to Plan
          </Button>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-base">Ingredients</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-[#E07B39] shrink-0">•</span>
                  <span>
                    {[ing.quantity, ing.unit, ing.item].filter(Boolean).join(' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Directions */}
        {recipe.directions?.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:col-span-1">
            <h2 className="font-semibold text-gray-800 mb-3 text-base">Directions</h2>
            <ol className="space-y-3">
              {recipe.directions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#E07B39] text-white text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {recipe && (
        <>
          <EditRecipeModal recipe={recipe} open={showEdit} onClose={() => setShowEdit(false)} onSaved={fetchRecipe} />
          <AddToPlanModal recipeId={recipe.id} open={showAddToPlan} onClose={() => setShowAddToPlan(false)} />
        </>
      )}
    </div>
  )
}
