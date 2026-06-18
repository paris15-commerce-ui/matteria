-- ============================================================
-- MatterGuide AI — Schéma initial
-- Postgres 15+ / Supabase. Extensions : pgcrypto, vector.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ---------- Enums ----------
create type plan_tier as enum ('trial', 'starter', 'pro', 'agence');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type lead_stage as enum ('visite', 'prospect', 'acquereur_chaud', 'offre', 'compromis', 'vente');
create type visit_mode as enum ('libre', 'guidee', 'groupe');
create type document_type as enum ('dpe', 'diagnostics', 'pv_ag', 'reglement_copro', 'taxe_fonciere', 'annonce', 'mandat', 'fiche_commerciale', 'autre');
create type document_status as enum ('processing', 'ready', 'error');

-- ---------- Organisations (agences) ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- Profils (1-1 avec auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'agent')),
  created_at timestamptz not null default now()
);

-- ---------- Abonnements Stripe ----------
create table subscriptions (
  organization_id uuid primary key references organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan plan_tier not null default 'trial',
  status subscription_status not null default 'trialing',
  current_period_end timestamptz,
  trial_end timestamptz default now() + interval '14 days',
  updated_at timestamptz not null default now()
);

-- ---------- Biens ----------
create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  address text,
  city text,
  postal_code text,
  property_type text default 'appartement',
  price numeric,
  surface numeric,
  rooms_count int,
  description text,
  highlights text[] not null default '{}',
  -- Données factuelles structurées servies à l'IA (DPE, charges, étage, exposition…)
  -- Clés libres : { "dpe": "D", "charges_mensuelles": "180 €", "exposition": "sud-ouest", ... }
  facts jsonb not null default '{}',
  matterport_model_id text not null,
  agent_name text not null default 'Claire',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_properties_org on properties(organization_id);

-- ---------- Pièces / parcours de visite ----------
create table property_rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,                       -- "Cuisine", "Séjour"…
  matterport_room_id text,                   -- id Room SDK (si dispo)
  sweep_ids text[] not null default '{}',    -- sweeps associés (le 1er = point d'arrêt du tour)
  position jsonb,                            -- centre {x,y,z} pour le fallback "sweep le plus proche"
  talking_points text[] not null default '{}', -- arguments de vente dictés à l'IA
  tour_order int not null default 0,
  include_in_tour boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_rooms_property on property_rooms(property_id);

-- ---------- Documents (base de connaissance RAG) ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  type document_type not null default 'autre',
  storage_path text not null,
  status document_status not null default 'processing',
  pages int,
  chunk_count int default 0,
  error text,
  created_at timestamptz not null default now()
);
create index idx_documents_property on documents(property_id);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'
);
create index idx_chunks_property on document_chunks(property_id);
create index idx_chunks_embedding on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ---------- Visites ----------
create table visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  lead_id uuid,
  mode visit_mode not null default 'libre',
  visitor_label text,                          -- prénom déclaré ou "Visiteur"
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  rooms_visited jsonb not null default '[]',   -- [{label, seconds}]
  transcript jsonb not null default '[]',      -- [{role, text, at}]
  qualification jsonb not null default '{}',   -- alimentée en live par les tools de l'IA
  engagement_score int,
  device text,
  referrer text
);
create index idx_visits_property on visits(property_id);
create index idx_visits_org_started on visits(organization_id, started_at desc);

create table visit_events (
  id bigint generated always as identity primary key,
  visit_id uuid not null references visits(id) on delete cascade,
  type text not null,            -- room_enter | sweep_move | question | tool_call | tour_step | vision
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_events_visit on visit_events(visit_id);

-- ---------- CRM ----------
create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  visit_id uuid references visits(id) on delete set null,
  full_name text,
  email text,
  phone text,
  stage lead_stage not null default 'visite',
  score int not null default 0,
  -- { interest_level, budget, financing, timeline, purpose, objections[], summary }
  qualification jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leads_org_stage on leads(organization_id, stage);

alter table visits
  add constraint fk_visits_lead foreign key (lead_id) references leads(id) on delete set null;

create table interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null,            -- visite_ia | note | appel | email | changement_etape
  content text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_interactions_lead on interactions(lead_id);

-- ---------- Questions (analytics FAQ) ----------
create table questions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  question text not null,
  answer text,
  room_label text,
  created_at timestamptz not null default now()
);
create index idx_questions_property on questions(property_id);

-- ---------- Visites de groupe ----------
create table group_sessions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null unique,        -- code court partagé aux participants
  host_key text not null,           -- secret du pilote (agent / IA leader)
  host_name text not null default 'Agent',
  status text not null default 'live' check (status in ('live', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_properties_updated before update on properties
  for each row execute function set_updated_at();
create trigger trg_leads_updated before update on leads
  for each row execute function set_updated_at();
create trigger trg_subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- À l'inscription : création automatique organisation + profil + abonnement trial
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'Mon agence'))
  returning id into new_org;

  insert into profiles (id, organization_id, email, full_name)
  values (new.id, new_org, new.email, new.raw_user_meta_data->>'full_name');

  insert into subscriptions (organization_id) values (new_org);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- RAG : recherche vectorielle
-- ============================================================

create or replace function match_document_chunks(
  p_property_id uuid,
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.2
) returns table (
  content text,
  document_name text,
  document_type document_type,
  similarity float
) language sql stable as $$
  select c.content, d.name, d.type, 1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.property_id = p_property_id
    and d.status = 'ready'
    and 1 - (c.embedding <=> query_embedding) > min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Analytics
-- ============================================================

-- Pièces les plus regardées (temps cumulé) sur une période
create or replace function top_rooms(p_org uuid, p_days int default 30, p_property uuid default null)
returns table (label text, total_seconds bigint, visits_count bigint)
language sql stable as $$
  select r->>'label' as label,
         sum((r->>'seconds')::int) as total_seconds,
         count(distinct v.id) as visits_count
  from visits v, jsonb_array_elements(v.rooms_visited) r
  where v.organization_id = p_org
    and v.started_at > now() - (p_days || ' days')::interval
    and (p_property is null or v.property_id = p_property)
  group by 1
  order by 2 desc
  limit 10;
$$;

-- Questions les plus fréquentes (regroupement simple par préfixe normalisé)
create or replace function top_questions(p_org uuid, p_days int default 30, p_property uuid default null)
returns table (question text, occurrences bigint)
language sql stable as $$
  select min(q.question) as question, count(*) as occurrences
  from questions q
  join properties p on p.id = q.property_id
  where p.organization_id = p_org
    and q.created_at > now() - (p_days || ' days')::interval
    and (p_property is null or q.property_id = p_property)
  group by lower(left(regexp_replace(q.question, '[^a-zA-Z0-9àâéèêëîïôûùüç ]', '', 'g'), 48))
  order by 2 desc
  limit 10;
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table properties enable row level security;
alter table property_rooms enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table visits enable row level security;
alter table visit_events enable row level security;
alter table leads enable row level security;
alter table interactions enable row level security;
alter table questions enable row level security;
alter table group_sessions enable row level security;

-- Helper : organisation de l'utilisateur connecté
create or replace function auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create policy org_read on organizations for select using (id = auth_org_id());
create policy org_update on organizations for update using (id = auth_org_id());

create policy profiles_self on profiles for select using (organization_id = auth_org_id());
create policy profiles_update_self on profiles for update using (id = auth.uid());

create policy subs_read on subscriptions for select using (organization_id = auth_org_id());

create policy props_all on properties for all
  using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());

create policy rooms_all on property_rooms for all
  using (property_id in (select id from properties where organization_id = auth_org_id()))
  with check (property_id in (select id from properties where organization_id = auth_org_id()));

create policy docs_all on documents for all
  using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());

create policy chunks_read on document_chunks for select
  using (property_id in (select id from properties where organization_id = auth_org_id()));

create policy visits_read on visits for select using (organization_id = auth_org_id());
create policy events_read on visit_events for select
  using (visit_id in (select id from visits where organization_id = auth_org_id()));

create policy leads_all on leads for all
  using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());

create policy interactions_all on interactions for all
  using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());

create policy questions_read on questions for select
  using (property_id in (select id from properties where organization_id = auth_org_id()));

create policy group_read on group_sessions for select
  using (property_id in (select id from properties where organization_id = auth_org_id()));

-- NB : les flux visiteurs anonymes (visites publiques, événements, leads créés
-- par l'IA, RAG) passent exclusivement par les API routes serveur qui utilisent
-- la clé service_role après vérification que le bien est publié.
