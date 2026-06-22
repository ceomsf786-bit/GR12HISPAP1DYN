# History Dynamic Quiz System — Student Dropdown Upgrade

This is the upgraded Grade 12 History quiz system.

It keeps the **one-HTML future workflow**:

- Keep the shared files unchanged.
- Add only one new quiz HTML file in future.
- Open that quiz once so it registers itself in Supabase.
- The hub and results dashboard update automatically.

## What changed in this version

Learners no longer type their own names.

They now:

1. Select their official name from a dropdown.
2. Enter the private learner code you gave them.
3. Submit only if the selected name and code match your Supabase student list.

Learner codes are not shown on the public results page.

## Upload these files to GitHub now

Upload and overwrite the whole repository once with this ZIP.

Important changed shared files:

- `setup.sql`
- `quiz-engine.js`
- `results.js`
- `results.html`
- `index.html`
- `config.js`
- `style.css`

Existing quiz pages are also included:

- `angola.html`
- `cold-war.html`
- `vietnam.html`
- `source-essay-hints.html`

## Run this once in Supabase

1. Open Supabase.
2. Go to **SQL Editor**.
3. Open the included `setup.sql`.
4. Copy all of it.
5. Paste it into Supabase.
6. Click **Run**.

This creates:

- `quiz_students` — your private student list with codes
- `quiz_students_public` — public dropdown list without codes
- `validate_quiz_student()` — checks name + code
- `quiz_results_public` — results view without learner codes
- updated insert rules for `quiz_results`

## Add your learners

### Option A: Supabase Table Editor

1. Open **Table Editor**.
2. Open `quiz_students`.
3. Add rows like this:

| student_name | student_code | class_group | active |
|---|---|---|---|
| Ayesha Khan | G12-001 | Grade 12 History | true |
| Yusuf Adams | G12-002 | Grade 12 History | true |
| Zainab Jacobs | G12-003 | Grade 12 History | true |

### Option B: SQL Editor

Use the included file:

- `add-students-template.sql`

Change the sample names and codes, then run it.

## Future workflow for new quizzes

In future, only upload the new quiz file, for example:

```text
civil-rights.html
```

Then open that quiz once in the browser. It will register itself in Supabase and appear on:

- `index.html`
- `results.html`
- the results dropdown

No need to edit `results.html`, `index.html`, or the shared scripts again.

## Important security note

This is strong enough for practice and revision quizzes. It prevents normal name mistakes and casual misuse.

For a formal controlled exam, a public GitHub quiz is still not fully secure because all browser code is visible to advanced users.
