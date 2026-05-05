-- Supernote Quote production schema.
--
-- Editing is controlled by Supabase Auth. Only trusted users should be
-- invited/created in Supabase Auth because every authenticated user can insert,
-- update, and delete quotes under these policies.

create table if not exists public.quotes (
  id text primary key,
  text text not null,
  book_title text not null,
  author text default '',
  language text not null check (language in ('en', 'de')),
  source_file text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.quotes enable row level security;

grant select, insert, update, delete on public.quotes to anon, authenticated;

drop policy if exists "Anyone can read quotes" on public.quotes;
create policy "Anyone can read quotes"
on public.quotes
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert quotes" on public.quotes;
create policy "Authenticated users can insert quotes"
on public.quotes
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update quotes" on public.quotes;
create policy "Authenticated users can update quotes"
on public.quotes
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete quotes" on public.quotes;
create policy "Authenticated users can delete quotes"
on public.quotes
for delete
to authenticated
using (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
before update on public.quotes
for each row
execute function public.set_updated_at();
