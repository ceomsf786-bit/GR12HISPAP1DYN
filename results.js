(() => {
  "use strict";

  const LOCAL_RESULTS_KEY = "history_live_quiz_results";
  const LOCAL_REGISTRY_KEY = "history_live_quiz_registry";
  const config = window.QUIZ_CONFIG || {};
  const groupId = config.DASHBOARD_GROUP || "grade12-history";
  const groupLabel = config.GROUP_LABEL || "Grade 12 History";

  const db = config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const modeBadge = document.getElementById("modeBadge");
  const filter = document.getElementById("quizFilter");
  const table = document.getElementById("resultsTable");
  const head = document.getElementById("resultsHead");
  const body = document.getElementById("resultsBody");
  const loadingMessage = document.getElementById("loadingMessage");
  const emptyMessage = document.getElementById("emptyMessage");
  const errorMessage = document.getElementById("resultsError");

  let quizList = [];
  let lastRows = [];

  function localJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function toRegistry(row) {
    return {
      quiz_id: row.quiz_id || row.id,
      quiz_title: row.quiz_title || row.title,
      short_title: row.short_title || row.shortTitle || row.quiz_title || row.title,
      description: row.description || "",
      file_name: row.file_name || row.file,
      bank_size: Number(row.bank_size || row.bankSize || 0),
      questions_per_attempt: Number(row.questions_per_attempt || row.questionsPerAttempt || config.QUESTIONS_PER_ATTEMPT || 30),
      group_id: row.group_id || row.group || groupId,
      updated_at: row.updated_at || ""
    };
  }

  function mergeById(...lists) {
    const map = new Map();
    lists.flat().map(toRegistry).forEach(item => {
      if (!item.quiz_id || item.group_id !== groupId) return;
      map.set(item.quiz_id, { ...(map.get(item.quiz_id) || {}), ...item });
    });
    return Array.from(map.values()).sort((a, b) => a.short_title.localeCompare(b.short_title));
  }

  async function fetchRegistry() {
    const starter = config.STARTER_QUIZZES || [];
    const local = localJson(LOCAL_REGISTRY_KEY, []);
    if (!db) return mergeById(starter, local);
    const { data, error } = await db
      .from("quiz_registry")
      .select("quiz_id, quiz_title, short_title, description, file_name, bank_size, questions_per_attempt, group_id, updated_at")
      .eq("group_id", groupId)
      .order("short_title", { ascending: true });
    if (error) return mergeById(starter, local);
    return mergeById(starter, local, data || []);
  }

  function setModeBadge() {
    if (!modeBadge) return;
    if (db) { modeBadge.textContent = `Live Supabase results • ${groupLabel}`; modeBadge.classList.add("live"); }
    else { modeBadge.textContent = "Demo mode"; modeBadge.classList.remove("live"); }
  }

  function setFilterOptions() {
    const current = new URLSearchParams(location.search).get("quiz") || filter.value || "all";
    filter.replaceChildren();
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = `All ${groupLabel} Quizzes`;
    filter.appendChild(all);
    quizList.forEach(quiz => {
      const option = document.createElement("option");
      option.value = quiz.quiz_id;
      option.textContent = quiz.short_title;
      filter.appendChild(option);
    });
    filter.value = quizList.some(q => q.quiz_id === current) ? current : "all";
  }

  function quizTitle(id) {
    const match = quizList.find(q => q.quiz_id === id);
    return match ? match.short_title : id;
  }

  async function fetchResults() {
    const ids = quizList.map(q => q.quiz_id).filter(Boolean);
    if (!db) {
      const rows = localJson(LOCAL_RESULTS_KEY, []);
      return rows.filter(row => (row.group_id || groupId) === groupId && (!ids.length || ids.includes(row.quiz_id)));
    }
    let query = db
      .from("quiz_results_public")
      .select("id, student_id, group_id, learner_name, quiz_id, quiz_title, score, total, percentage, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (ids.length) query = query.in("quiz_id", ids);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function rankBadge(index) {
    if (index === 0) return "🏆 1";
    if (index === 1) return "🥈 2";
    if (index === 2) return "🥉 3";
    return String(index + 1);
  }

  function scoreCell(value) {
    const span = document.createElement("span");
    span.className = "score-pill";
    span.textContent = `${value}%`;
    return span;
  }

  function setStats(rows, learnersCount) {
    document.getElementById("learnerCount").textContent = String(learnersCount);
    document.getElementById("attemptCount").textContent = String(rows.length);
    const quizCountEl = document.getElementById("quizCount");
    if (quizCountEl) quizCountEl.textContent = String(quizList.length);
    document.getElementById("classAverage").textContent = rows.length ? `${Math.round(rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / rows.length)}%` : "0%";
    document.getElementById("lastUpdated").textContent = new Intl.DateTimeFormat("en-ZA", { timeStyle: "short" }).format(new Date());
  }

  function groupByLearner(rows) {
    const map = new Map();
    rows.forEach(row => {
      const key = String(row.student_id || row.learner_name).trim().toUpperCase();
      if (!map.has(key)) map.set(key, { learner_name: row.learner_name, rows: [] });
      map.get(key).rows.push(row);
    });
    return Array.from(map.values());
  }

  function renderAllQuizzes(rows) {
    const learners = groupByLearner(rows).map(learner => {
      const byQuiz = new Map();
      learner.rows.forEach(row => {
        if (!byQuiz.has(row.quiz_id)) byQuiz.set(row.quiz_id, []);
        byQuiz.get(row.quiz_id).push(row);
      });
      const bestPerQuiz = Array.from(byQuiz.entries()).map(([quizId, quizRows]) => ({
        quiz_id: quizId,
        title: quizTitle(quizId),
        best: Math.max(...quizRows.map(row => Number(row.percentage))),
        latest: quizRows.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0],
        attempts: quizRows.length
      }));
      const latest = learner.rows.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const overallAverage = Math.round(bestPerQuiz.reduce((sum, item) => sum + item.best, 0) / bestPerQuiz.length);
      const bestScore = Math.max(...bestPerQuiz.map(item => item.best));
      return {
        learner_name: latest.learner_name,
        quizzes_done: byQuiz.size,
        attempts: learner.rows.length,
        overallAverage,
        bestScore,
        latest_quiz: quizTitle(latest.quiz_id),
        latest_date: latest.created_at,
        breakdown: bestPerQuiz.sort((a, b) => a.title.localeCompare(b.title)).map(item => `${item.title}: ${item.best}%`).join(" • ")
      };
    }).sort((a, b) => b.overallAverage - a.overallAverage || b.quizzes_done - a.quizzes_done || a.learner_name.localeCompare(b.learner_name));

    setStats(rows, learners.length);
    head.innerHTML = `<tr><th>Rank</th><th>Learner</th><th>Quizzes Done</th><th>Average</th><th>Best</th><th>Attempts</th><th>Latest Quiz</th><th>Quiz Breakdown</th></tr>`;
    body.replaceChildren();
    learners.forEach((learner, index) => {
      const tr = document.createElement("tr");
      [rankBadge(index), learner.learner_name, `${learner.quizzes_done}/${quizList.length || learner.quizzes_done}`, "AVERAGE", "BEST", String(learner.attempts), `${learner.latest_quiz} (${formatDate(learner.latest_date)})`, learner.breakdown].forEach(value => {
        const td = document.createElement("td");
        if (value === "AVERAGE") td.appendChild(scoreCell(learner.overallAverage));
        else if (value === "BEST") td.appendChild(scoreCell(learner.bestScore));
        else td.textContent = value;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return learners.length;
  }

  function renderSingleQuiz(rows, quizId) {
    const selectedRows = rows.filter(row => row.quiz_id === quizId);
    const learners = groupByLearner(selectedRows).map(learner => {
      const sorted = learner.rows.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latest = sorted[0];
      return {
        learner_name: latest.learner_name,
        latest: Number(latest.percentage),
        best: Math.max(...sorted.map(row => Number(row.percentage))),
        average: Math.round(sorted.reduce((sum, row) => sum + Number(row.percentage), 0) / sorted.length),
        attempts: sorted.length,
        last_attempt: latest.created_at
      };
    }).sort((a, b) => b.latest - a.latest || b.best - a.best || a.learner_name.localeCompare(b.learner_name));

    setStats(selectedRows, learners.length);
    head.innerHTML = `<tr><th>Rank</th><th>Learner</th><th>Latest</th><th>Best</th><th>Average</th><th>Attempts</th><th>Last Attempt</th></tr>`;
    body.replaceChildren();
    learners.forEach((learner, index) => {
      const tr = document.createElement("tr");
      [rankBadge(index), learner.learner_name, "LATEST", "BEST", "AVERAGE", String(learner.attempts), formatDate(learner.last_attempt)].forEach(value => {
        const td = document.createElement("td");
        if (value === "LATEST") td.appendChild(scoreCell(learner.latest));
        else if (value === "BEST") td.appendChild(scoreCell(learner.best));
        else if (value === "AVERAGE") td.appendChild(scoreCell(learner.average));
        else td.textContent = value;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return learners.length;
  }

  function render(rows) {
    loadingMessage.classList.add("hidden");
    errorMessage.classList.add("hidden");
    const learnersCount = filter.value === "all" ? renderAllQuizzes(rows) : renderSingleQuiz(rows, filter.value);
    if (learnersCount === 0) { table.classList.add("hidden"); emptyMessage.classList.remove("hidden"); }
    else { emptyMessage.classList.add("hidden"); table.classList.remove("hidden"); }
  }

  async function loadResults() {
    try {
      quizList = await fetchRegistry();
      setFilterOptions();
      lastRows = await fetchResults();
      render(lastRows);
    } catch (error) {
      console.error(error);
      loadingMessage.classList.add("hidden");
      table.classList.add("hidden");
      emptyMessage.classList.add("hidden");
      errorMessage.textContent = "Results could not be loaded. Check config.js and run the grade-group Supabase SQL.";
      errorMessage.classList.remove("hidden");
    }
  }

  filter.addEventListener("change", () => render(lastRows));
  document.getElementById("refreshButton")?.addEventListener("click", loadResults);
  document.getElementById("printButton")?.addEventListener("click", () => window.print());
  setModeBadge();
  loadResults();
  window.setInterval(loadResults, Math.max(5, Number(config.RESULTS_REFRESH_SECONDS) || 10) * 1000);
  if (db) db.channel("grade12-history-results").on("postgres_changes", { event: "*", schema: "public", table: "quiz_results" }, loadResults).on("postgres_changes", { event: "*", schema: "public", table: "quiz_registry" }, loadResults).subscribe();
})();
