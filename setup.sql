-- Dynamic History live quiz system with student dropdown + private learner-code check.
-- Run this ONCE in Supabase SQL Editor after uploading this upgraded system.
-- It keeps your old results but changes future quiz submissions to use pre-created students.

create extension if not exists pgcrypto;

-- Private student list. Learners can see names through a public view, but codes are not listed.
create table if not exists public.quiz_students (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (char_length(student_name) between 2 and 80),
  student_code text not null check (char_length(student_code) between 2 and 40),
  class_group text not null default 'Grade 12 History',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quiz_students_code_unique_idx
  on public.quiz_students (upper(trim(student_code)));

create index if not exists quiz_students_active_name_idx
  on public.quiz_students (active, student_name);

alter table public.quiz_students enable row level security;

-- Do not grant public select on quiz_students. Codes stay off the public API.
revoke all on table public.quiz_students from anon, authenticated;

drop view if exists public.quiz_students_public;
create view public.quiz_students_public as
select
  id as student_id,
  student_name,
  class_group
from public.quiz_students
where active = true;

grant select on public.quiz_students_public to anon, authenticated;

-- Learner-code validation. Returns a row only when the selected student and code match.
create or replace function public.validate_quiz_student(
  p_student_id uuid,
  p_student_code text
)
returns table (
  student_id uuid,
  student_name text,
  class_group text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.student_name, s.class_group
  from public.quiz_students s
  where s.id = p_student_id
    and s.active = true
    and upper(trim(s.student_code)) = upper(trim(coalesce(p_student_code, '')))
  limit 1;
$$;

grant execute on function public.validate_quiz_student(uuid, text) to anon, authenticated;

-- Boolean helper used by the quiz_results insert policy.
-- This avoids giving public SELECT access to the private quiz_students table.
create or replace function public.is_valid_quiz_student(
  p_student_id uuid,
  p_student_name text,
  p_student_code text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_students s
    where s.id = p_student_id
      and s.active = true
      and s.student_name = p_student_name
      and upper(trim(s.student_code)) = upper(trim(coalesce(p_student_code, '')))
  );
$$;

grant execute on function public.is_valid_quiz_student(uuid, text, text) to anon, authenticated;

-- Results table.
create table if not exists public.quiz_results (
  id bigint generated always as identity primary key,
  learner_name text not null check (char_length(learner_name) between 2 and 80),
  learner_code text not null check (char_length(learner_code) between 2 and 40),
  quiz_id text not null check (char_length(quiz_id) between 2 and 100),
  quiz_title text not null check (char_length(quiz_title) between 2 and 160),
  score integer not null check (score >= 0),
  total integer not null check (total between 1 and 100),
  percentage integer not null check (percentage between 0 and 100),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint score_not_more_than_total check (score <= total)
);

alter table public.quiz_results
  add column if not exists student_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'quiz_results'
      and constraint_name = 'quiz_results_student_id_fkey'
  ) then
    alter table public.quiz_results
      add constraint quiz_results_student_id_fkey
      foreign key (student_id) references public.quiz_students(id);
  end if;
end $$;

create index if not exists quiz_results_student_id_idx
  on public.quiz_results (student_id);

create index if not exists quiz_results_quiz_id_created_at_idx
  on public.quiz_results (quiz_id, created_at desc);

create index if not exists quiz_results_learner_code_idx
  on public.quiz_results (learner_code);

alter table public.quiz_results enable row level security;

drop policy if exists "Public can submit quiz attempts" on public.quiz_results;
drop policy if exists "Public can view quiz results" on public.quiz_results;

-- Future inserts must match an active student + learner code.
create policy "Public can submit quiz attempts"
  on public.quiz_results
  for insert
  to anon, authenticated
  with check (
    score >= 0
    and score <= total
    and percentage between 0 and 100
    and char_length(learner_name) between 2 and 80
    and char_length(learner_code) between 2 and 40
    and public.is_valid_quiz_student(
      quiz_results.student_id,
      quiz_results.learner_name,
      quiz_results.learner_code
    )
  );

-- Only insert into the private table. Results are read through quiz_results_public below.
revoke select on table public.quiz_results from anon, authenticated;
grant insert on table public.quiz_results to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop view if exists public.quiz_results_public;
create view public.quiz_results_public as
select
  id,
  student_id,
  learner_name,
  quiz_id,
  quiz_title,
  score,
  total,
  percentage,
  created_at
from public.quiz_results;

grant select on public.quiz_results_public to anon, authenticated;

-- Registry table: lets index.html and results.html discover new quizzes automatically.
create table if not exists public.quiz_registry (
  quiz_id text primary key check (char_length(quiz_id) between 2 and 100),
  quiz_title text not null check (char_length(quiz_title) between 2 and 160),
  short_title text not null check (char_length(short_title) between 2 and 80),
  description text not null default '',
  file_name text not null check (char_length(file_name) between 2 and 200),
  bank_size integer not null default 0 check (bank_size >= 0),
  questions_per_attempt integer not null default 30 check (questions_per_attempt between 1 and 100),
  group_id text not null default 'history-live-quizzes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_registry_group_title_idx
  on public.quiz_registry (group_id, short_title);

alter table public.quiz_registry enable row level security;

drop policy if exists "Public can view quiz registry" on public.quiz_registry;
drop policy if exists "Public can register quiz" on public.quiz_registry;
drop policy if exists "Public can update quiz registry" on public.quiz_registry;

create policy "Public can view quiz registry"
  on public.quiz_registry
  for select
  to anon, authenticated
  using (true);

create policy "Public can register quiz"
  on public.quiz_registry
  for insert
  to anon, authenticated
  with check (
    char_length(quiz_id) between 2 and 100
    and char_length(quiz_title) between 2 and 160
    and char_length(short_title) between 2 and 80
    and char_length(file_name) between 2 and 200
  );

create policy "Public can update quiz registry"
  on public.quiz_registry
  for update
  to anon, authenticated
  using (true)
  with check (
    char_length(quiz_id) between 2 and 100
    and char_length(quiz_title) between 2 and 160
    and char_length(short_title) between 2 and 80
    and char_length(file_name) between 2 and 200
  );

grant select, insert, update on table public.quiz_registry to anon, authenticated;

insert into public.quiz_registry
  (quiz_id, quiz_title, short_title, description, file_name, bank_size, questions_per_attempt, group_id, updated_at)
values
  ('grade12-history-angola', 'Grade 12 History: Angola Source-Based Quiz', 'Angola', 'Angola source-based questions: colonialism, nationalist movements, foreign intervention, Cuito Cuanavale and New York Accords.', 'angola.html', 100, 30, 'history-live-quizzes', now()),
  ('grade12-history-cold-war', 'Grade 12 History: Cold War Source-Based Quiz', 'Cold War', 'Cold War origins source-based questions: Iron Curtain, Truman Doctrine, Marshall Plan, Berlin crises and Cuban Missile Crisis.', 'cold-war.html', 100, 30, 'history-live-quizzes', now()),
  ('grade12-history-vietnam', 'Grade 12 History: Vietnam Essay Quiz', 'Vietnam', 'Vietnam essay preparation questions: USA involvement, tactics, Viet Cong tactics, public opinion and withdrawal.', 'vietnam.html', 100, 30, 'history-live-quizzes', now()),
  ('grade12-history-source-essay-hints', 'Grade 12 History: Source & Essay Skills Quiz', 'Source & Essay Skills', 'Exam technique quiz: cognitive levels, source skills, reliability, usefulness, bias, cartoons, paragraph writing and essay structure.', 'source-essay-hints.html', 100, 30, 'history-live-quizzes', now())
on conflict (quiz_id) do update set
  quiz_title = excluded.quiz_title,
  short_title = excluded.short_title,
  description = excluded.description,
  file_name = excluded.file_name,
  bank_size = excluded.bank_size,
  questions_per_attempt = excluded.questions_per_attempt,
  group_id = excluded.group_id,
  updated_at = now();

-- Optional Realtime registration. The pages also refresh every few seconds.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_results'
  ) then
    alter publication supabase_realtime add table public.quiz_results;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_registry'
  ) then
    alter publication supabase_realtime add table public.quiz_registry;
  end if;
end $$;
