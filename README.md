# Meal Planner

A full-stack meal planning web app built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Weekly Planner** — calendar view (Mon–Sun), drag & fill lunch/dinner slots, smart ingredient overlap suggestions, shopping list with clipboard copy
- **Recipe Library** — grid with image cards, multi-filter (cuisine, ingredient, difficulty, time), scrape from any URL or enter manually
- **Recipe Detail** — full ingredients + directions, add directly to meal plan
- **Pantry Manager** — grouped inventory, "What can I make?" match against saved recipes with % match

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Deployment | Vercel |

---

## Environment Variables

Create a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are found in your Supabase project → **Settings → API**.

---

## Database Setup

1. Go to your [Supabase project](https://supabase.com) → **SQL Editor**
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it
3. This creates three tables (`recipes`, `meal_plan`, `pantry`) with open public (anon) RLS policies

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in your Supabase credentials
cp .env.local.example .env.local   # or edit .env.local directly

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/planner`.

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — done

---

## Project Structure

```
app/
  layout.tsx          # Root layout with sidebar + toaster
  page.tsx            # Redirects → /planner
  planner/page.tsx    # Weekly calendar view
  recipes/
    page.tsx          # Recipe grid + filters
    [id]/page.tsx     # Recipe detail
  pantry/page.tsx     # Pantry manager
  api/
    scrape-recipe/    # POST: scrape recipe from URL

components/
  shared/Sidebar.tsx  # Collapsible nav sidebar
  ui/                 # Button, Badge, Modal primitives
  recipes/            # AddRecipeModal, EditRecipeModal, AddToPlanModal
  planner/            # SlotModal

lib/
  supabase/client.ts  # Browser Supabase client
  utils.ts            # cn(), date helpers, constants

supabase/
  schema.sql          # Full DB schema with RLS policies
```

---

## Recipe Scraper

`POST /api/scrape-recipe` accepts `{ url: string }` and:
1. Tries to parse `schema.org/Recipe` JSON-LD (works on AllRecipes, NYT Cooking, Serious Eats, etc.)
2. Falls back to OpenGraph + heuristic CSS selectors
3. Returns `{ name, imageUrl, ingredients[], directions[], sourceUrl }`

Fields that can't be extracted are left blank for manual completion.
