-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recipes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  image_url       TEXT,
  source_url      TEXT,
  cuisine         TEXT,
  main_ingredient TEXT,
  difficulty      TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  cook_type       TEXT CHECK (cook_type IN ('Pan', 'Oven', 'Air Fryer', 'Crockpot')),
  time_minutes    INT,
  ingredients     JSONB DEFAULT '[]',
  directions      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Allow full public (anon) access
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to recipes" ON public.recipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- MEAL PLAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_plan (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start    DATE NOT NULL,
  day_of_week   TEXT NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  meal_type     TEXT NOT NULL CHECK (meal_type IN ('lunch','dinner')),
  recipe_id     UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  custom_label  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start, day_of_week, meal_type)
);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to meal_plan" ON public.meal_plan FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PANTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pantry (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name   TEXT NOT NULL,
  quantity    TEXT,
  unit        TEXT,
  category    TEXT CHECK (category IN ('Produce','Dairy','Meat','Pantry','Frozen','Other')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pantry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to pantry" ON public.pantry FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
