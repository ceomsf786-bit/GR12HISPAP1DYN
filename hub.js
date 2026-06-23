(() => {
  "use strict";
  const LOCAL_REGISTRY_KEY = "history_live_quiz_registry";
  const config = window.QUIZ_CONFIG || {};
  const groupId = config.DASHBOARD_GROUP || "grade12-history";
  const groupLabel = config.GROUP_LABEL || "Grade 12 History";
  const db = config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY) : null;
  const grid = document.getElementById("quizGrid");
  const hubMessage = document.getElementById("hubMessage");
  const modeBadge = document.getElementById("modeBadge");
  function localJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function toRegistry(row) { return { quiz_id: row.quiz_id || row.id, quiz_title: row.quiz_title || row.title, short_title: row.short_title || row.shortTitle || row.quiz_title || row.title, description: row.description || "", file_name: row.file_name || row.file, bank_size: Number(row.bank_size || row.bankSize || 0), questions_per_attempt: Number(row.questions_per_attempt || row.questionsPerAttempt || config.QUESTIONS_PER_ATTEMPT || 30), group_id: row.group_id || row.group || groupId, updated_at: row.updated_at || "" }; }
  function mergeById(...lists) { const map = new Map(); lists.flat().map(toRegistry).forEach(item => { if (!item.quiz_id || item.group_id !== groupId) return; map.set(item.quiz_id, { ...(map.get(item.quiz_id) || {}), ...item }); }); return Array.from(map.values()).sort((a, b) => a.short_title.localeCompare(b.short_title)); }
  async function fetchRegistry() { const starter = config.STARTER_QUIZZES || []; const local = localJson(LOCAL_REGISTRY_KEY, []); if (!db) return mergeById(starter, local); const { data, error } = await db.from("quiz_registry").select("quiz_id, quiz_title, short_title, description, file_name, bank_size, questions_per_attempt, group_id, updated_at").eq("group_id", groupId).order("short_title", { ascending: true }); if (error) return mergeById(starter, local); return mergeById(starter, local, data || []); }
  function render(quizzes) { grid.replaceChildren(); if (!quizzes.length) { hubMessage?.classList.remove("hidden"); if (hubMessage) hubMessage.textContent = `No ${groupLabel} quizzes found.`; return; } hubMessage?.classList.add("hidden"); quizzes.forEach(quiz => { const card = document.createElement("article"); card.className = "quiz-card"; card.innerHTML = `<div><div class="meta-row"><span class="pill">${quiz.bank_size || "?"} questions</span><span class="pill">${quiz.questions_per_attempt || 30} per attempt</span></div><h3></h3><p></p></div><div class="quiz-card-actions"><a class="primary-button button-link" href="${quiz.file_name}">Open quiz</a><a class="secondary-button button-link" href="results.html?quiz=${encodeURIComponent(quiz.quiz_id)}">View results</a></div>`; card.querySelector("h3").textContent = quiz.short_title || quiz.quiz_title; card.querySelector("p").textContent = quiz.description || "Self-marking quiz with shared live results."; grid.appendChild(card); }); }
  async function load() { if (modeBadge) { if (db) { modeBadge.textContent = `Live quiz registry • ${groupLabel}`; modeBadge.classList.add("live"); } else { modeBadge.textContent = "Demo registry"; modeBadge.classList.remove("live"); } } try { render(await fetchRegistry()); } catch (error) { console.error(error); if (hubMessage) { hubMessage.classList.remove("hidden"); hubMessage.textContent = "Could not load quiz list. Check config.js and Supabase."; } } }
  document.getElementById("refreshHubButton")?.addEventListener("click", load);
  load();
  if (db) db.channel("grade12-history-registry").on("postgres_changes", { event: "*", schema: "public", table: "quiz_registry" }, load).subscribe();
})();
