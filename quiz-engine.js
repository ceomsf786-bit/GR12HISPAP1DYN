(() => {
  "use strict";

  const LOCAL_RESULTS_KEY = "history_live_quiz_results";
  const LOCAL_REGISTRY_KEY = "history_live_quiz_registry";
  const LOCAL_STUDENTS_KEY = "history_live_quiz_students";
  const config = window.QUIZ_CONFIG || {};
  const groupId = config.DASHBOARD_GROUP || "grade12-history";
  const groupLabel = config.GROUP_LABEL || "Grade 12 History";

  function loadQuizApp() {
    const jsonEl = document.getElementById("quiz-app-data");
    if (jsonEl && jsonEl.textContent.trim()) return JSON.parse(jsonEl.textContent);
    if (window.QUIZ_APP) return window.QUIZ_APP;

    const quizId = document.body.dataset.quizId;
    const quizMeta = (config.STARTER_QUIZZES || window.QUIZ_LIST || []).find(q => q.id === quizId) || {};
    const questions = (window.HISTORY_QUIZ_DATA || {})[quizId] || [];
    return {
      id: quizId,
      title: quizMeta.title || quizId,
      shortTitle: quizMeta.shortTitle || quizMeta.title || quizId,
      description: quizMeta.description || "30 random questions each attempt • Self-marking • Live saved results",
      file: quizMeta.file || location.pathname.split("/").pop(),
      group: groupId,
      subject: "GRADE 12 HISTORY",
      questionsPerAttempt: Number(config.QUESTIONS_PER_ATTEMPT) || 30,
      questions
    };
  }

  const app = loadQuizApp();
  const fullBank = Array.isArray(app.questions) ? app.questions : [];
  const quizId = String(app.id || "").trim();
  const quizTitle = String(app.title || quizId || "History Quiz").trim();
  const shortTitle = String(app.shortTitle || quizTitle).trim();
  const fileName = String(app.file || location.pathname.split("/").pop() || "quiz.html").trim();
  const questionsPerAttempt = Math.min(Number(app.questionsPerAttempt || config.QUESTIONS_PER_ATTEMPT) || 30, fullBank.length);

  const isConfigured =
    typeof config.SUPABASE_URL === "string" &&
    config.SUPABASE_URL.startsWith("https://") &&
    typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
    config.SUPABASE_PUBLISHABLE_KEY.length > 20;

  const db = isConfigured && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const form = document.getElementById("quizForm");
  const questionsContainer = document.getElementById("questionsContainer");
  const formMessage = document.getElementById("formMessage");
  const submitButton = document.getElementById("submitButton");
  const resultPanel = document.getElementById("resultPanel");
  const modeBadge = document.getElementById("modeBadge");
  const progressText = document.getElementById("progressText");
  const progressBar = document.getElementById("progressBar");

  let attemptQuestions = [];
  let students = [];
  let studentsLoaded = false;

  function localJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function saveRegistryLocally(row) {
    const rows = localJson(LOCAL_REGISTRY_KEY, []);
    const filtered = rows.filter(item => item.quiz_id !== row.quiz_id);
    filtered.push(row);
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(filtered));
  }

  async function registerQuiz() {
    if (!quizId || !fullBank.length) return;
    const registryRow = {
      quiz_id: quizId,
      quiz_title: quizTitle,
      short_title: shortTitle,
      description: String(app.description || "").trim().slice(0, 500),
      file_name: fileName,
      bank_size: fullBank.length,
      questions_per_attempt: questionsPerAttempt,
      group_id: groupId,
      updated_at: new Date().toISOString()
    };
    saveRegistryLocally(registryRow);
    if (!db) return;
    const { error } = await db.from("quiz_registry").upsert(registryRow, { onConflict: "quiz_id" });
    if (error) console.warn("Quiz registry could not update", error);
  }

  function applyMetaToPage() {
    document.title = quizTitle;
    const subjectEl = document.getElementById("quizSubject");
    const titleEl = document.getElementById("quizTitle");
    const descriptionEl = document.getElementById("quizDescription");
    if (subjectEl) subjectEl.textContent = app.subject || "GRADE 12 HISTORY";
    if (titleEl) titleEl.textContent = quizTitle;
    if (descriptionEl) descriptionEl.textContent = app.description || "30 random questions each attempt • Self-marking • Live saved results";
  }

  function setModeBadge() {
    if (!modeBadge) return;
    if (db) {
      modeBadge.textContent = `Live Supabase results • ${groupLabel}`;
      modeBadge.classList.add("live");
    } else {
      modeBadge.textContent = "Demo mode: this browser only";
      modeBadge.classList.remove("live");
    }
    const qBadge = document.getElementById("questionCountBadge");
    if (qBadge) qBadge.textContent = `${questionsPerAttempt} of ${fullBank.length} questions`;
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      let j;
      if (window.crypto && crypto.getRandomValues) {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        j = values[0] % (i + 1);
      } else j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function normaliseText(value) {
    return String(value || "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function normaliseCode(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function safeText(value, maxLength = 10000) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
  }

  function ensureLearnerSelect() {
    const existing = document.getElementById("learnerName");
    if (!existing) return null;
    if (existing.tagName.toLowerCase() === "select") return existing;
    const select = document.createElement("select");
    select.id = "learnerName";
    select.required = true;
    existing.replaceWith(select);
    const note = select.closest(".learner-panel")?.querySelector(".small-note");
    if (note) note.textContent = `Select your official ${groupLabel} name, then enter your private learner code.`;
    return select;
  }

  function localStudents() {
    const configured = Array.isArray(config.DEMO_STUDENTS) ? config.DEMO_STUDENTS : [];
    const saved = localJson(LOCAL_STUDENTS_KEY, []);
    return (configured.length ? configured : saved).map((student, index) => ({
      student_id: student.student_id || student.id || `demo-student-${index + 1}`,
      student_name: student.student_name || student.name || "Unnamed learner",
      student_code: student.student_code || student.code || "",
      class_group: student.class_group || groupLabel,
      group_id: student.group_id || groupId
    })).filter(student => student.student_name && student.student_id && student.group_id === groupId);
  }

  async function fetchStudents() {
    if (!db) return localStudents();
    const { data, error } = await db
      .from("quiz_students_public")
      .select("student_id, student_name, class_group, group_id")
      .eq("group_id", groupId)
      .order("student_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function setupStudentDropdown() {
    const select = ensureLearnerSelect();
    if (!select) return;
    select.disabled = true;
    select.innerHTML = `<option value="">Loading ${groupLabel} learners…</option>`;
    try {
      students = await fetchStudents();
      studentsLoaded = true;
      select.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = students.length ? "Select your name" : `No ${groupLabel} learners found`;
      select.appendChild(placeholder);
      students.forEach(student => {
        const option = document.createElement("option");
        option.value = student.student_id;
        option.textContent = student.student_name;
        option.dataset.name = student.student_name;
        select.appendChild(option);
      });
      select.disabled = students.length === 0;
    } catch (error) {
      console.error(error);
      studentsLoaded = false;
      select.innerHTML = `<option value="">Learner list could not load</option>`;
      if (formMessage) formMessage.textContent = "Learner list could not load. Run the grade-group Supabase SQL first.";
    }
  }

  async function validateStudentSelection() {
    const select = document.getElementById("learnerName");
    const codeInput = document.getElementById("learnerCode");
    const studentId = safeText(select?.value, 80);
    const typedCode = safeText(codeInput?.value, 40);
    if (!studentsLoaded) return { ok: false, message: "Learner list is still loading. Wait a few seconds and try again." };
    if (!studentId) return { ok: false, message: `Please select your ${groupLabel} name.`, focus: select };
    if (typedCode.length < 2) return { ok: false, message: "Please enter your learner code.", focus: codeInput };

    if (!db) {
      const match = students.find(s => s.student_id === studentId && normaliseCode(s.student_code) === normaliseCode(typedCode));
      if (!match) return { ok: false, message: `That learner code does not match the selected ${groupLabel} learner.`, focus: codeInput };
      return { ok: true, student_id: match.student_id, learner_name: match.student_name, learner_code: normaliseCode(typedCode) };
    }

    const { data, error } = await db.rpc("validate_quiz_student_group", {
      p_student_id: studentId,
      p_student_code: typedCode,
      p_group_id: groupId
    });
    if (error) throw error;
    const match = Array.isArray(data) ? data[0] : data;
    if (!match) return { ok: false, message: `That learner code does not match the selected ${groupLabel} learner.`, focus: codeInput };
    return { ok: true, student_id: match.student_id, learner_name: match.student_name, learner_code: normaliseCode(typedCode) };
  }

  function updateProgress() {
    const answered = getAnswers().filter(answer => answer !== null && answer !== "").length;
    if (progressText) progressText.textContent = `${answered} of ${attemptQuestions.length} answered`;
    if (progressBar) progressBar.style.width = `${attemptQuestions.length ? Math.round((answered / attemptQuestions.length) * 100) : 0}%`;
  }

  function makeQuestionCard(question, index) {
    const card = document.createElement("section");
    card.className = "question-card";
    card.dataset.index = String(index);
    const meta = document.createElement("div");
    meta.className = "question-meta";
    const number = document.createElement("span");
    number.className = "question-number";
    number.textContent = `QUESTION ${index + 1}`;
    const category = document.createElement("span");
    category.className = "pill";
    category.textContent = question.category || "General";
    meta.append(number, category);
    if (question.skill) {
      const skill = document.createElement("span");
      skill.className = "pill";
      skill.textContent = question.skill;
      meta.appendChild(skill);
    }
    card.appendChild(meta);
    if (question.sourceText) {
      const source = document.createElement("div");
      source.className = "source-box";
      const sourceLabel = document.createElement("strong");
      sourceLabel.textContent = question.sourceType ? `Source (${question.sourceType}): ` : "Source: ";
      const sourceText = document.createElement("span");
      sourceText.textContent = question.sourceText;
      source.append(sourceLabel, sourceText);
      card.appendChild(source);
    }
    const qText = document.createElement("p");
    qText.className = "question-text";
    qText.textContent = question.question;
    card.appendChild(qText);

    if (question.type === "fillblank" || !question.options || question.options.length === 0) {
      const wrapper = document.createElement("div");
      wrapper.className = "fill-answer";
      const label = document.createElement("label");
      label.textContent = "Your answer";
      const input = document.createElement("input");
      input.type = "text";
      input.name = `question-${index}`;
      input.placeholder = "Type your answer here";
      input.addEventListener("input", updateProgress);
      label.appendChild(input);
      wrapper.appendChild(label);
      card.appendChild(wrapper);
      return card;
    }

    const options = document.createElement("div");
    options.className = "options";
    shuffle(question.options).forEach((optionText, optionIndex) => {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question-${index}`;
      input.value = optionText;
      input.id = `q${index}-o${optionIndex}`;
      input.addEventListener("change", () => {
        options.querySelectorAll(".option").forEach(el => el.classList.remove("selected"));
        label.classList.add("selected");
        updateProgress();
      });
      const span = document.createElement("span");
      span.textContent = optionText;
      label.append(input, span);
      options.appendChild(label);
    });
    card.appendChild(options);
    return card;
  }

  function renderQuiz() {
    attemptQuestions = shuffle(fullBank).slice(0, questionsPerAttempt);
    const fragment = document.createDocumentFragment();
    attemptQuestions.forEach((question, index) => fragment.appendChild(makeQuestionCard(question, index)));
    questionsContainer.replaceChildren(fragment);
    updateProgress();
  }

  function getAnswers() {
    return attemptQuestions.map((question, index) => {
      if (question.type === "fillblank" || !question.options || question.options.length === 0) {
        const input = document.querySelector(`input[name="question-${index}"]`);
        return input ? safeText(input.value, 250) : "";
      }
      const checked = document.querySelector(`input[name="question-${index}"]:checked`);
      return checked ? checked.value : null;
    });
  }

  function isCorrect(question, selected) {
    if (question.type === "fillblank" || !question.options || question.options.length === 0) {
      return normaliseText(selected) === normaliseText(question.answer);
    }
    return selected === question.answer;
  }

  function saveLocally(result) {
    const current = localJson(LOCAL_RESULTS_KEY, []);
    current.push(result);
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(current));
  }

  async function saveResult(result) {
    if (!db) { saveLocally(result); return { live: false }; }
    const { error } = await db.from("quiz_results").insert({
      student_id: result.student_id,
      group_id: groupId,
      learner_name: result.learner_name,
      learner_code: result.learner_code,
      quiz_id: result.quiz_id,
      quiz_title: result.quiz_title,
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      answers: result.answers
    });
    if (error) throw error;
    return { live: true };
  }

  function markUI(answers) {
    attemptQuestions.forEach((question, index) => {
      const card = document.querySelector(`[data-index="${index}"]`);
      if (question.type === "fillblank" || !question.options || question.options.length === 0) {
        const input = card.querySelector("input");
        input.disabled = true;
        input.classList.add(isCorrect(question, answers[index]) ? "correct-input" : "incorrect-input");
        return;
      }
      card.querySelectorAll(".option").forEach(label => {
        const input = label.querySelector("input");
        input.disabled = true;
        if (input.value === question.answer) label.classList.add("correct");
        if (input.checked && input.value !== question.answer) label.classList.add("incorrect");
      });
    });
  }

  function showResult(score, answers, savedLive) {
    const total = attemptQuestions.length;
    const percentage = Math.round((score / total) * 100);
    document.getElementById("scoreNumber").textContent = `${score}/${total}`;
    document.getElementById("scorePercent").textContent = `${percentage}%`;
    let comment = "Keep practising and review the corrections below.";
    if (percentage >= 85) comment = "Excellent work. Strong exam readiness.";
    else if (percentage >= 70) comment = "Good work. Review the corrections to strengthen your mark.";
    else if (percentage >= 50) comment = "Fair attempt. Revise the weaker sections and try a new random quiz.";
    document.getElementById("resultComment").textContent = `${comment} Result saved ${savedLive ? "to the shared live dashboard" : "in demo mode on this browser"}.`;

    const review = document.createElement("div");
    review.className = "review-list";
    attemptQuestions.forEach((question, index) => {
      const correct = isCorrect(question, answers[index]);
      const item = document.createElement("div");
      item.className = `review-item ${correct ? "correct" : "incorrect"}`;
      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${correct ? "Correct" : "Incorrect"} — ${question.category || "General"}`;
      const answerLine = document.createElement("div");
      answerLine.textContent = correct ? `Answer: ${question.answer}` : `Your answer: ${answers[index] || "No answer"} • Correct answer: ${question.answer}`;
      const explanation = document.createElement("div");
      explanation.className = "small-note";
      explanation.textContent = question.explanation || "";
      item.append(title, answerLine, explanation);
      review.appendChild(item);
    });
    document.getElementById("answerReview").replaceChildren(review);
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    let learner;
    try { learner = await validateStudentSelection(); }
    catch (error) {
      console.error(error);
      formMessage.textContent = "Learner code could not be checked. Run the grade-group Supabase SQL first.";
      return;
    }
    if (!learner.ok) { formMessage.textContent = learner.message; learner.focus?.focus(); return; }

    const answers = getAnswers();
    const unansweredIndex = answers.findIndex(answer => answer === null || answer === "");
    if (unansweredIndex !== -1) {
      formMessage.textContent = `Please answer Question ${unansweredIndex + 1}.`;
      document.querySelector(`[data-index="${unansweredIndex}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const score = answers.reduce((sum, selected, index) => sum + (isCorrect(attemptQuestions[index], selected) ? 1 : 0), 0);
    const resultAnswers = attemptQuestions.map((question, index) => ({
      question_id: question.id,
      category: question.category,
      skill: question.skill || "",
      question: question.question,
      selected: answers[index],
      correct: question.answer,
      is_correct: isCorrect(question, answers[index])
    }));

    const result = {
      local_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      student_id: learner.student_id,
      learner_name: learner.learner_name,
      learner_code: learner.learner_code,
      quiz_id: quizId,
      quiz_title: quizTitle,
      score,
      total: attemptQuestions.length,
      percentage: Math.round((score / attemptQuestions.length) * 100),
      answers: resultAnswers,
      created_at: new Date().toISOString()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Saving result…";
    try {
      await registerQuiz();
      const saved = await saveResult(result);
      markUI(answers);
      showResult(score, answers, saved.live);
      submitButton.textContent = "Result saved";
    } catch (error) {
      console.error(error);
      formMessage.textContent = "The quiz was marked, but the online result could not be saved. Check Supabase setup and learner codes.";
      submitButton.disabled = false;
      submitButton.textContent = "Try saving again";
    }
  });

  document.getElementById("tryAgainButton").addEventListener("click", () => {
    form.reset();
    resultPanel.classList.add("hidden");
    submitButton.disabled = false;
    submitButton.textContent = "Mark and save result";
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  applyMetaToPage();
  if (!quizId || !fullBank.length) {
    questionsContainer.innerHTML = `<section class="panel error-message">This quiz could not be loaded. Check the quiz JSON inside this HTML file.</section>`;
    submitButton.disabled = true;
    return;
  }
  setModeBadge();
  setupStudentDropdown();
  registerQuiz();
  renderQuiz();
})();
