-- Birthday automation data, accessed only by server-side service-role routes.
create table if not exists public.birthday_contacts (
  user_id uuid not null,
  contact_id text not null,
  contact_name text not null,
  first_name text not null,
  email text,
  birth_date date not null,
  consent boolean not null default false,
  excluded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, contact_id)
);

create table if not exists public.birthday_email_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id text not null,
  contact_name text not null,
  sent_at timestamptz not null default now(),
  type text not null check (type = 'anniversaire'),
  channel text not null check (channel = 'courriel'),
  subject text not null,
  status text not null check (status in ('envoyé', 'échoué')),
  message text not null,
  error text,
  year integer not null,
  test_mode boolean not null default false,
  destination text not null
);

create unique index if not exists birthday_email_once_per_year
  on public.birthday_email_history (user_id, contact_id, year)
  where test_mode = false and status = 'envoyé';

create index if not exists birthday_contacts_birth_date_idx
  on public.birthday_contacts (birth_date);

create index if not exists birthday_email_history_user_sent_idx
  on public.birthday_email_history (user_id, sent_at desc);

alter table public.birthday_contacts enable row level security;
alter table public.birthday_email_history enable row level security;

-- No browser policies are created intentionally. The service-role route is the
-- only writer/reader; it validates the dashboard session or CRON_SECRET first.
