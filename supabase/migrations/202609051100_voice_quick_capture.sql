-- TICKET #052 — échéances naturelles des captures vocales.
-- Une journée connue sans heure reste une date, sans heure artificielle.

alter table public.tasks
  add column if not exists due_on date,
  add column if not exists due_context text;

create index if not exists tasks_due_on_idx
  on public.tasks (user_id, status, due_on)
  where due_on is not null;

comment on column public.tasks.due_on is 'Date d’échéance lorsque la dictée précise une journée, mais aucune heure.';
comment on column public.tasks.due_context is 'Expression temporelle originale, par exemple mardi ou après mon rendez-vous.';

notify pgrst, 'reload schema';

