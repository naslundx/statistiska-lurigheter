// main.js
// App shell: loads content, generates variables, and drives navigation
// through intro -> topics/parts -> outro.

import { resolveVariables, renderText } from "./variables.js";
import { renderPart, LINE_DELAY } from "./render.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const stage = document.getElementById("stage");
const topbar = document.getElementById("topbar");
const topicLabel = document.getElementById("topicLabel");
const topicCount = document.getElementById("topicCount");
const skipBtn = document.getElementById("skipBtn");
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
  // Page below the first item -> intro; above the last item -> outro.
  if (!Number.isFinite(n) || n < 1) {
    renderIntro();
    return;
  }

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
  // n is larger than the number of content items -> outro.
  renderOutro();
}

function setupChrome() {
  const site = state.data.site || {};
  const link = document.getElementById("linkedinLink");
  if (site.linkedin) link.href = site.linkedin;

  backBtn.addEventListener("click", goBack);
  skipBtn.addEventListener("click", skipTopic);
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
  clearPageUrl();
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

  let savedPage = 0;
  try {
    savedPage = parseInt(localStorage.getItem("statsexplainer_page") || "0", 10);
  } catch (e) {}

  if (savedPage > 1) {
    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "btn btn--continue";
    continueBtn.textContent = "Fortsätt från senast";
    continueBtn.addEventListener("click", () => jumpToPage(savedPage));
    hero.appendChild(continueBtn);
  }

  stage.appendChild(hero);
}

function startJourney() {
  state.topicIndex = 0;
  state.partIndex = firstVisiblePart(0);
  state.history = [];
  renderCurrent();
}

async function renderOutro() {
  topbar.hidden = true;
  clearPageUrl();
  try {
    localStorage.removeItem("statsexplainer_page");
  } catch (e) {}
  const outro = state.data.outro || {};
  stage.innerHTML = "";

  const hero = document.createElement("div");
  hero.className = "hero";
  
  const emoji = document.createElement("div");
  emoji.className = "hero__emoji";
  emoji.textContent = outro.emoji || "🎉";
  hero.appendChild(emoji);

  const title = document.createElement("h1");
  title.className = "hero__title";
  title.textContent = outro.title || "Bra jobbat!";
  hero.appendChild(title);
  
  stage.appendChild(hero);

  const itemsToReveal = [];

  const texts = Array.isArray(outro.text) ? outro.text : (outro.text ? [outro.text] : []);
  for (const t of texts) {
    const p = document.createElement("p");
    p.className = "hero__subtitle line--text";
    p.style.visibility = "hidden";
    p.innerHTML = renderText(t, {});
    hero.appendChild(p);
    itemsToReveal.push(p);
  }

  if (Array.isArray(outro.links) && outro.links.length) {
    const ul = document.createElement("ul");
    ul.className = "links links--outro";
    hero.appendChild(ul);
    
    for (const l of outro.links) {
      const li = document.createElement("li");
      li.style.visibility = "hidden";
      const a = document.createElement("a");
      a.href = l.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "link-card";
      
      if (l.image) {
        const img = document.createElement("img");
        img.src = l.image;
        img.alt = "";
        img.className = "link-card__image";
        if (l.cover) {
          img.style.objectFit = "cover";
        }
        a.appendChild(img);
      }
      
      const span = document.createElement("span");
      span.innerHTML = renderText(l.label, {});
      span.className = "link-card__label";
      a.appendChild(span);
      
      li.appendChild(a);
      ul.appendChild(li);
      itemsToReveal.push(li);
    }
  }

  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "btn btn--start";
  restart.style.visibility = "hidden";
  restart.textContent = outro.restart || "Börja om";
  restart.addEventListener("click", () => {
    // Regenerate variables so numbers change (no statefulness).
    state.topicVars = state.data.topics.map((t) => resolveVariables(t.variables));
    renderIntro();
  });
  hero.appendChild(restart);
  itemsToReveal.push(restart);

  stage.appendChild(hero);

  for (const el of itemsToReveal) {
    await delay(LINE_DELAY);
    el.style.visibility = "visible";
    el.classList.add("line");
  }
}

/* ------------------------------------------------------------ Navigation */

function renderCurrent() {
  const topic = state.data.topics[state.topicIndex];
  const part = topic.parts[state.partIndex];
  const vars = state.topicVars[state.topicIndex];

  topbar.hidden = false;
  topicLabel.textContent = topic.title;
  topicCount.textContent = `(${state.topicIndex + 1}/${state.data.topics.length})`;
  skipBtn.hidden = state.topicIndex >= state.data.topics.length - 1;
  backBtn.hidden = state.history.length === 0;
  updateProgress();
  updatePageUrl();

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

function skipTopic() {
  const nextTopic = state.topicIndex + 1;
  if (nextTopic >= state.data.topics.length) {
    renderOutro();
    return;
  }
  state.history.push({ topicIndex: state.topicIndex, partIndex: state.partIndex });
  state.topicIndex = nextTopic;
  state.partIndex = firstVisiblePart(nextTopic);
  renderCurrent();
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

/** The 1-indexed global part number (matches the `?page=N` argument). */
function currentPageNumber() {
  let count = 1;
  for (let t = 0; t < state.topicIndex; t++) {
    count += state.data.topics[t].parts.length;
  }
  return count + state.partIndex;
}

function updatePageUrl() {
  const pageNum = currentPageNumber();
  const url = new URL(window.location.href);
  url.searchParams.set("page", String(pageNum));
  window.history.replaceState(null, "", url);
  
  try {
    localStorage.setItem("statsexplainer_page", String(pageNum));
  } catch (e) {}
}

function clearPageUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("page")) return;
  url.searchParams.delete("page");
  window.history.replaceState(null, "", url);
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
