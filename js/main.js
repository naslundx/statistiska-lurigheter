// main.js
// App shell: loads content, generates variables, and drives navigation
// through intro -> topics/parts -> outro.

import { resolveVariables } from "./variables.js";
import { renderPart } from "./render.js";

const stage = document.getElementById("stage");
const topbar = document.getElementById("topbar");
const topicLabel = document.getElementById("topicLabel");
const progressBar = document.getElementById("progressBar");
const backBtn = document.getElementById("backBtn");
const homeBtn = document.getElementById("homeBtn");

const state = {
  data: null,
  topicVars: [], // resolved variables per topic (generated on load)
  topicIndex: 0,
  partIndex: 0,
  answers: {}, // key `${topicIndex}:${questionId}` -> value
  history: [], // stack of {topicIndex, partIndex} for the back button
  renderId: 0, // used to abort ghost renders on rapid navigation
};

init();

async function init() {
  try {
    const res = await fetch("content.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    stage.innerHTML =
      `<p class="line line--text">Kunde inte ladda innehållet. ` +
      `Kör sidan via en webbserver (se README).</p>`;
    console.error(err);
    return;
  }

  // Generate variable values once, per topic.
  state.topicVars = state.data.topics.map((t) => resolveVariables(t.variables));

  setupChrome();

  const params = new URLSearchParams(window.location.search);
  const pageStr = params.get("page");
  if (pageStr) {
    const pageNum = parseInt(pageStr, 10);
    jumpToPage(pageNum);
  } else {
    renderIntro();
  }
}

function jumpToPage(n) {
  let count = 1;
  for (let t = 0; t < state.data.topics.length; t++) {
    const parts = state.data.topics[t].parts;
    for (let p = 0; p < parts.length; p++) {
      if (count === n) {
        state.topicIndex = t;
        state.partIndex = p;
        state.history = [];
        renderCurrent();
        return;
      }
      count++;
    }
  }
  // Om page inte hittas, fallback till intro
  renderIntro();
}

function setupChrome() {
  const site = state.data.site || {};
  const link = document.getElementById("linkedinLink");
  if (site.linkedin) link.href = site.linkedin;

  backBtn.addEventListener("click", goBack);
  homeBtn.addEventListener("click", () => {
    state.history = [];
    renderIntro();
  });

  // Global keyboard navigation
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isFocusOnInteractive = active && (active.tagName === "BUTTON" || active.tagName === "A");

    if (e.key === "Enter" || e.key === " ") {
      // If the user is already focused on a button or link, let the native click happen
      if (isFocusOnInteractive) return;

      const nextBtn = document.querySelector(".btn--next, .btn--start");
      if (nextBtn && !nextBtn.hidden) {
        e.preventDefault(); // Prevent spacebar from scrolling down
        nextBtn.click();
      }
    } else if (e.key === "ArrowRight") {
      const nextBtn = document.querySelector(".btn--next, .btn--start");
      if (nextBtn && !nextBtn.hidden) nextBtn.click();
    } else if (e.key === "ArrowLeft") {
      const prevBtn = document.querySelector(".btn--prev, .topbar__back");
      if (prevBtn && !prevBtn.hidden) prevBtn.click();
    }
  });
}

/* --------------------------------------------------------------- Screens */

function renderIntro() {
  topbar.hidden = true;
  const intro = state.data.intro || {};
  stage.innerHTML = "";

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <h1 class="hero__title">${escape(intro.title || state.data.site?.title || "")}</h1>
    <p class="hero__subtitle">${escape(intro.subtitle || "")}</p>
    ${intro.description ? `<p class="hero__desc">${escape(intro.description)}</p>` : ""}
  `;

  const start = document.createElement("button");
  start.type = "button";
  start.className = "btn btn--start";
  start.textContent = intro.start || "Börja";
  start.addEventListener("click", startJourney);
  hero.appendChild(start);

  stage.appendChild(hero);
}

function startJourney() {
  state.topicIndex = 0;
  state.partIndex = firstVisiblePart(0);
  state.history = [];
  renderCurrent();
}

function renderOutro() {
  topbar.hidden = true;
  const outro = state.data.outro || {};
  stage.innerHTML = "";

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="hero__emoji">${outro.emoji || "🎉"}</div>
    <h1 class="hero__title">${escape(outro.title || "Bra jobbat!")}</h1>
    <p class="hero__subtitle">${escape(outro.text || "")}</p>
  `;

  if (Array.isArray(outro.links) && outro.links.length) {
    const ul = document.createElement("ul");
    ul.className = "links";
    outro.links.forEach((l) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = l.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.label;
      li.appendChild(a);
      ul.appendChild(li);
    });
    hero.appendChild(ul);
  }

  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "btn btn--start";
  restart.textContent = outro.restart || "Börja om";
  restart.addEventListener("click", () => {
    // Regenerate variables so numbers change (no statefulness).
    state.topicVars = state.data.topics.map((t) => resolveVariables(t.variables));
    renderIntro();
  });
  hero.appendChild(restart);

  stage.appendChild(hero);
}

/* ------------------------------------------------------------ Navigation */

function renderCurrent() {
  const topic = state.data.topics[state.topicIndex];
  const part = topic.parts[state.partIndex];
  const vars = state.topicVars[state.topicIndex];

  topbar.hidden = false;
  topicLabel.textContent = topic.title;
  backBtn.hidden = state.history.length === 0;
  updateProgress();

  stage.innerHTML = "";
  window.scrollTo({ top: 0 });

  // Announce a new topic with a large title on its first part.
  // Skipped for the very first topic, so we get straight into it.
  const isNewTopic = state.topicIndex > 0 && state.partIndex === firstVisiblePart(state.topicIndex);
  if (isNewTopic) {
    const heading = document.createElement("h2");
    heading.className = "topic-title line";
    heading.textContent = topic.title;
    stage.appendChild(heading);
  }

  const currentRenderId = ++state.renderId;

  renderPart(stage, part, vars, {
    onAnswer: (id, value) => {
      state.answers[`${state.topicIndex}:${id}`] = value;
    },
    onDone: goNext,
    onBack: goBack,
    canBack: state.history.length > 0,
    isNewTopic: isNewTopic,
    isAborted: () => state.renderId !== currentRenderId,
  });
}

function goNext() {
  state.history.push({ topicIndex: state.topicIndex, partIndex: state.partIndex });

  let t = state.topicIndex;
  let p = state.partIndex + 1;

  while (t < state.data.topics.length) {
    const parts = state.data.topics[t].parts;
    if (p >= parts.length) {
      t++;
      p = 0;
      continue;
    }
    if (isVisible(t, parts[p])) {
      state.topicIndex = t;
      state.partIndex = p;
      renderCurrent();
      return;
    }
    p++;
  }

  renderOutro();
}

function goBack() {
  const prev = state.history.pop();
  if (!prev) {
    renderIntro();
    return;
  }
  state.topicIndex = prev.topicIndex;
  state.partIndex = prev.partIndex;
  renderCurrent();
}

/** Whether a part should show, based on its optional `showIf` condition. */
function isVisible(topicIndex, part) {
  if (!part.showIf) return true;
  const { question, equals } = part.showIf;
  return String(state.answers[`${topicIndex}:${question}`]) === String(equals);
}

function firstVisiblePart(topicIndex) {
  const parts = state.data.topics[topicIndex].parts;
  for (let p = 0; p < parts.length; p++) {
    if (isVisible(topicIndex, parts[p])) return p;
  }
  return 0;
}

function updateProgress() {
  // Progress across the parts of the CURRENT topic only (resets each topic).
  const parts = state.data.topics[state.topicIndex].parts;
  let total = 0;
  let done = 0;
  parts.forEach((part, pi) => {
    if (!isVisible(state.topicIndex, part)) return;
    total++;
    if (pi <= state.partIndex) done++;
  });
  
  let pct = 0;
  if (total > 1) {
    pct = Math.round(((done - 1) / (total - 1)) * 100);
  } else if (total === 1) {
    pct = 100;
  }
  
  progressBar.style.width = `${pct}%`;
}

function escape(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}
