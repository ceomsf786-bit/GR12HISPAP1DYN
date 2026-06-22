(() => {
  "use strict";

  const LOCAL_REGISTRY_KEY = "history_live_quiz_registry";
  const config = window.QUIZ_CONFIG || {};
  const groupId = config.DASHBOARD_GROUP || "history-live-quizzes";

  const isConfigured =
    typeof config.SUPABASE_URL === "string" &&
    config.SUPABASE_URL.startsWith("https://") &&
    !config.SUPABASE_URL.includes("PASTE_") &&
    typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
    config.SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !config.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

  const db = isConfigured && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const grid = document.getElementById("quizGrid");
  const hubMessage = document.getElementById("hubMessage");
  const modeBadge = document.getElementById("modeBadge");

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

  function localJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
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

    if (error) {
      console.warn("Could not load quiz_registry; using starter quiz list.", error);
      return mergeById(starter, local);
    }
    return mergeById(starter, local, data || []);
  }

  function render(quizzes) {
    grid.replaceChildren();

    if (!quizzes.length) {
      hubMessage.classList.remove("hidden");
      hubMessage.textContent = "No quizzes found yet. Open a quiz HTML page once so it can register itself.";
      return;
    }

    hubMessage.classList.add("hidden");

    quizzes.forEach(quiz => {
      const card = document.createElement("article");
      card.className = "quiz-card";

      const meta = document.createElement("div");
      meta.className = "meta-row";
      const bank = document.createElement("span");
      bank.className = "pill";
      bank.textContent = `${quiz.bank_size || "?"} questions`;
      const perAttempt = document.createElement("span");
      perAttempt.className = "pill";
      perAttempt.textContent = `${quiz.questions_per_attempt || 30} per attempt`;
      meta.append(bank, perAttempt);

      const title = document.createElement("h3");
      title.textContent = quiz.short_title || quiz.quiz_title;

      const desc = document.createElement("p");
      desc.textContent = quiz.description || "Self-marking quiz with shared live results.";

      const actions = document.createElement("div");
      actions.className = "quiz-card-actions";
      const open = document.createElement("a");
      open.className = "primary-button button-link";
      open.href = quiz.file_name;
      open.textContent = "Open quiz";
      const results = document.createElement("a");
      results.className = "secondary-button button-link";
      results.href = `results.html?quiz=${encodeURIComponent(quiz.quiz_id)}`;
      results.textContent = "View results";
      actions.append(open, results);

      const top = document.createElement("div");
      top.append(meta, title, desc);
      card.append(top, actions);
      grid.appendChild(card);
    });
  }

  async function load() {
    if (modeBadge) {
      if (db) {
        modeBadge.textContent = "Live quiz registry";
        modeBadge.classList.add("live");
      } else {
        modeBadge.textContent = "Demo registry";
        modeBadge.classList.remove("live");
      }
    }

    try {
      const quizzes = await fetchRegistry();
      render(quizzes);
    } catch (error) {
      console.error(error);
      hubMessage.classList.remove("hidden");
      hubMessage.textContent = "Could not load quiz list. Check config.js and setup.sql.";
    }
  }

  document.getElementById("refreshHubButton")?.addEventListener("click", load);
  load();

  if (db) {
    db.channel("quiz-registry-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_registry" }, load)
      .subscribe();
  }
})();
