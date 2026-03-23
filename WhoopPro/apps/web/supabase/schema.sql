create extension if not exists "pgcrypto";

create type public.objective_type as enum (
  'performance',
  'balance',
  'recovery',
  'consistency'
);

create type public.chronotype_type as enum (
  'morning',
  'balanced',
  'evening'
);

create type public.training_intent_type as enum (
  'rest',
  'light',
  'moderate',
  'intense'
);

create type public.integration_provider as enum (
  'whoop',
  'google_calendar',
  'oura'
);

create type public.day_mode_type as enum (
  'Strategic',
  'Focused',
  'Execution-stable',
  'Low-reserve',
  'Recovery-first'
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text not null default 'Europe/Paris',
  objective objective_type not null default 'performance',
  chronotype chronotype_type not null default 'balanced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider integration_provider not null,
  provider_user_id text,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.daily_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_date date not null,
  objective objective_type not null,
  chronotype chronotype_type not null,
  training_intent training_intent_type not null,
  recovery_score integer not null check (recovery_score between 0 and 100),
  sleep_hours numeric(4,2) not null check (sleep_hours between 0 and 14),
  sleep_efficiency integer not null check (sleep_efficiency between 0 and 100),
  sleep_quality integer not null check (sleep_quality between 0 and 100),
  strain_yesterday numeric(4,2) not null check (strain_yesterday between 0 and 21),
  hrv_trend numeric(5,2) not null,
  resting_hr_delta numeric(5,2) not null,
  stress_load integer not null check (stress_load between 0 and 100),
  social_battery integer not null check (social_battery between 0 and 100),
  mental_freshness integer not null check (mental_freshness between 0 and 100),
  meetings_planned integer not null check (meetings_planned between 0 and 24),
  focus_blocks_planned integer not null check (focus_blocks_planned between 0 and 12),
  decision_load integer not null check (decision_load between 0 and 100),
  travel_load integer not null check (travel_load between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, signal_date)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_date date not null,
  source_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_high_stakes boolean not null default false,
  is_socially_heavy boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source_event_id)
);

create table if not exists public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_date date not null,
  day_mode day_mode_type not null,
  synopsis text not null,
  primary_recommendation text not null,
  warning text not null,
  scores jsonb not null,
  windows jsonb not null,
  suggested_moves jsonb not null,
  recalibration_triggers jsonb not null,
  end_of_day_prompts jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, signal_date)
);

create table if not exists public.daily_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_date date not null,
  perceived_energy integer check (perceived_energy between 0 and 100),
  perceived_clarity integer check (perceived_clarity between 0 and 100),
  day_quality integer check (day_quality between 0 and 100),
  free_text text,
  created_at timestamptz not null default now(),
  unique (user_id, signal_date)
);

create index if not exists idx_daily_signals_user_date
  on public.daily_signals(user_id, signal_date desc);

create index if not exists idx_calendar_events_user_date
  on public.calendar_events(user_id, signal_date desc);

create index if not exists idx_daily_briefings_user_date
  on public.daily_briefings(user_id, signal_date desc);

alter table public.profiles enable row level security;
alter table public.integrations enable row level security;
alter table public.daily_signals enable row level security;
alter table public.calendar_events enable row level security;
alter table public.daily_briefings enable row level security;
alter table public.daily_feedback enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_modify_own"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "integrations_own"
  on public.integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_signals_own"
  on public.daily_signals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "calendar_events_own"
  on public.calendar_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_briefings_own"
  on public.daily_briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_feedback_own"
  on public.daily_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
