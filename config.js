/* Grade 12 History group fix
   This keeps History learners separate from Grade 6 Math learners. */
window.QUIZ_CONFIG = {
  SUPABASE_URL: "https://qndabpagszkfblpgdhfe.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_XQ5_fH9Tuu8et01m2VCD9w_pWi70sgt",
  RESULTS_REFRESH_SECONDS: 10,
  QUESTIONS_PER_ATTEMPT: 30,
  DASHBOARD_GROUP: "grade12-history",
  GROUP_LABEL: "Grade 12 History",
  SHOW_UNKNOWN_QUIZZES: false,
  STUDENT_DROPDOWN_ENABLED: true,
  DEMO_STUDENTS: [],
  STARTER_QUIZZES: [
    {
      id: "grade12-history-angola",
      title: "Grade 12 History: Angola Source-Based Quiz",
      shortTitle: "Angola",
      file: "angola.html",
      bankSize: 100,
      questionsPerAttempt: 30,
      group: "grade12-history",
      description: "Angola source-based questions."
    },
    {
      id: "grade12-history-cold-war",
      title: "Grade 12 History: Cold War Source-Based Quiz",
      shortTitle: "Cold War",
      file: "cold-war.html",
      bankSize: 100,
      questionsPerAttempt: 30,
      group: "grade12-history",
      description: "Cold War source-based questions."
    },
    {
      id: "grade12-history-vietnam",
      title: "Grade 12 History: Vietnam Essay Quiz",
      shortTitle: "Vietnam",
      file: "vietnam.html",
      bankSize: 100,
      questionsPerAttempt: 30,
      group: "grade12-history",
      description: "Vietnam essay practice questions."
    },
    {
      id: "grade12-history-source-essay-hints",
      title: "Grade 12 History: Source & Essay Skills Quiz",
      shortTitle: "Source & Essay Skills",
      file: "source-essay-hints.html",
      bankSize: 100,
      questionsPerAttempt: 30,
      group: "grade12-history",
      description: "Source skills and essay-writing technique."
    }
  ]
};
