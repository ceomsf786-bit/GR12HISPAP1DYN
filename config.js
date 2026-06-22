/*
  Dynamic History Live Quiz System
  --------------------------------
  Future workflow:
  - Keep these shared files unchanged.
  - Add only the new quiz HTML file.
  - Open the new quiz once after uploading so it registers itself in Supabase.

  The key below is your Supabase publishable browser key, not a secret service key.
*/
window.QUIZ_CONFIG = {
  SUPABASE_URL: "https://qndabpagszkfblpgdhfe.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_XQ5_fH9Tuu8et01m2VCD9w_pWi70sgt",
  RESULTS_REFRESH_SECONDS: 10,
  QUESTIONS_PER_ATTEMPT: 30,
  DASHBOARD_GROUP: "history-live-quizzes",
  SHOW_UNKNOWN_QUIZZES: false,
  STUDENT_DROPDOWN_ENABLED: true,

  // Demo students are only used when Supabase is not connected. Live students come from the quiz_students table.
  DEMO_STUDENTS: [],

  /* These four starter quizzes are kept here only so your hub shows immediately.
     Future quizzes do NOT need to be added here; the new quiz HTML registers itself. */
  STARTER_QUIZZES: [
  {
    "id": "grade12-history-angola",
    "title": "Grade 12 History: Angola Source-Based Quiz",
    "shortTitle": "Angola",
    "file": "angola.html",
    "bankSize": 100,
    "questionsPerAttempt": 30,
    "group": "history-live-quizzes",
    "description": "Angola source-based questions: colonialism, nationalist movements, foreign intervention, Cuito Cuanavale and New York Accords."
  },
  {
    "id": "grade12-history-cold-war",
    "title": "Grade 12 History: Cold War Source-Based Quiz",
    "shortTitle": "Cold War",
    "file": "cold-war.html",
    "bankSize": 100,
    "questionsPerAttempt": 30,
    "group": "history-live-quizzes",
    "description": "Cold War origins source-based questions: Iron Curtain, Truman Doctrine, Marshall Plan, Berlin crises and Cuban Missile Crisis."
  },
  {
    "id": "grade12-history-vietnam",
    "title": "Grade 12 History: Vietnam Essay Quiz",
    "shortTitle": "Vietnam",
    "file": "vietnam.html",
    "bankSize": 100,
    "questionsPerAttempt": 30,
    "group": "history-live-quizzes",
    "description": "Vietnam essay preparation questions: USA involvement, tactics, Viet Cong tactics, public opinion and withdrawal."
  },
  {
    "id": "grade12-history-source-essay-hints",
    "title": "Grade 12 History: Source & Essay Skills Quiz",
    "shortTitle": "Source & Essay Skills",
    "file": "source-essay-hints.html",
    "bankSize": 100,
    "questionsPerAttempt": 30,
    "group": "history-live-quizzes",
    "description": "Exam technique quiz: cognitive levels, source skills, reliability, usefulness, bias, cartoons, paragraph writing and essay structure."
  }
]
};
