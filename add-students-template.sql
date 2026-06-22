-- Add your learners here, then run in Supabase SQL Editor.
-- Change the names and codes before running.
-- Keep each student_code unique.

insert into public.quiz_students (student_name, student_code, class_group, active)
values
  ('Ayesha Khan', 'G12-001', 'Grade 12 History', true),
  ('Yusuf Adams', 'G12-002', 'Grade 12 History', true),
  ('Zainab Jacobs', 'G12-003', 'Grade 12 History', true)
on conflict (upper(trim(student_code))) do nothing;
