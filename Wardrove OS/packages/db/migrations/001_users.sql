-- ─── Users profile table ────────────────────────────────────────────────────
-- Extends Supabase auth.users with application-specific profile data.
-- id mirrors auth.users.id and equals auth.uid() in all RLS policies.

CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  avatar_url          TEXT,
  style_preferences   JSONB,
  location_lat        DOUBLE PRECISION,
  location_lng        DOUBLE PRECISION,
  weather_cache       JSONB,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row only"
  ON public.users
  FOR ALL
  USING (auth.uid() = id);

-- ─── Trigger: auto-create profile on signup ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)   -- fallback for email/password signups
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
