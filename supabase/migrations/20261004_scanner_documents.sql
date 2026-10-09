-- Scanner intelligent de documents : alias produits appris par commerçant
-- et audit des scans. RLS stricte : un commerçant ne voit JAMAIS les alias
-- ou scans d'un autre (isolation par user_id).

create table if not exists product_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references produits(id) on delete cascade not null,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'user_confirmed',
  confidence numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, normalized_alias)
);

alter table product_aliases enable row level security;

create policy "product_aliases_select" on product_aliases
  for select using (auth.uid() = user_id);
create policy "product_aliases_insert" on product_aliases
  for insert with check (auth.uid() = user_id);
create policy "product_aliases_update" on product_aliases
  for update using (auth.uid() = user_id);
create policy "product_aliases_delete" on product_aliases
  for delete using (auth.uid() = user_id);

create table if not exists document_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  document_type text,
  image_url text,
  raw_extraction jsonb,
  status text not null default 'analysee', -- analysee | validee | rejetee | echouee
  confidence numeric,
  idempotence_key text unique, -- anti-doublon : une même photo n'est jamais enregistrée deux fois
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table document_scans enable row level security;

create policy "document_scans_select" on document_scans
  for select using (auth.uid() = user_id);
create policy "document_scans_insert" on document_scans
  for insert with check (auth.uid() = user_id);
create policy "document_scans_update" on document_scans
  for update using (auth.uid() = user_id);
create policy "document_scans_delete" on document_scans
  for delete using (auth.uid() = user_id);

create table if not exists document_scan_items (
  id uuid primary key default gen_random_uuid(),
  document_scan_id uuid references document_scans(id) on delete cascade not null,
  raw_name text,
  matched_product_id uuid references produits(id) on delete set null,
  quantity numeric,
  unit text,
  unit_price numeric,
  total_price numeric,
  confidence numeric,
  matching_method text,
  user_confirmed boolean default false,
  created_at timestamptz default now()
);

alter table document_scan_items enable row level security;

-- Les lignes suivent le scan parent : accès via la propriété du document.
create policy "document_scan_items_select" on document_scan_items
  for select using (exists (
    select 1 from document_scans s where s.id = document_scan_id and s.user_id = auth.uid()
  ));
create policy "document_scan_items_insert" on document_scan_items
  for insert with check (exists (
    select 1 from document_scans s where s.id = document_scan_id and s.user_id = auth.uid()
  ));
create policy "document_scan_items_update" on document_scan_items
  for update using (exists (
    select 1 from document_scans s where s.id = document_scan_id and s.user_id = auth.uid()
  ));
create policy "document_scan_items_delete" on document_scan_items
  for delete using (exists (
    select 1 from document_scans s where s.id = document_scan_id and s.user_id = auth.uid()
  ));
