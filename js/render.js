// render.js
// Renders one "part" (a full page) into the stage: reveals each line with a
// staggered animation, handles graphs, and handles interactive option buttons.

import { renderText } from "./variables.js";
import { createGraph } from "./graph.js";

const LINE_DELAY = 550; // ms between lines appearing

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Render a part.
 *
 * @param {HTMLElement} stage   container to render into (already cleared)
 * @param {object} part         { lines: [...] }
 * @param {object} vars         resolved variables for the topic
 * @param {object} ctx          { onAnswer(id, value), onDone() }
 *
 * A line can be:
 *   "text with $vars and *emphasis*"
 *   { graph: {...} }
 *   { options: { id, choices: [...], correct?, reveal?: { value|"*": [lines] } } }
 */
export async function renderPart(stage, part, vars, ctx) {
  let hasOptions = false;

  for (const line of part.lines) {
    if (line && typeof line === "object" && line.options) {
      hasOptions = true;
      await revealOptions(stage, line.options, vars, ctx);
      // Flow pauses here until the user answers (handled inside revealOptions).
    } else {
      appendLine(stage, line, vars);
      await delay(LINE_DELAY);
    }
  }

  // Only auto-show the "next" button when the part has no options.
  // (Option parts show it themselves once the user has answered.)
  if (!hasOptions) {
    showNav(stage, ctx);
  }
}

function appendLine(stage, line, vars) {
  if (typeof line === "string") {
    const p = document.createElement("p");
    p.className = "line line--text";
    p.innerHTML = renderText(line, vars);
    stage.appendChild(p);
    return p;
  }

  if (line && typeof line === "object" && line.graph) {
    const g = createGraph(line.graph);
    stage.appendChild(g);
    return g;
  }

  // Unknown line type -> ignore gracefully.
  return null;
}

function revealOptions(stage, opts, vars, ctx) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "options line";

    opts.choices.forEach((choice, idx) => {
      const value = typeof choice === "object" ? choice.value : choice;
      const label = typeof choice === "object" ? choice.label : choice;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.innerHTML = renderText(label, vars);
      btn.addEventListener("click", () =>
        choose(value, btn)
      );
      wrap.appendChild(btn);
    });

    stage.appendChild(wrap);

    // Ensure focus lands on the first option so that TAB starts cycling right away
    // instead of resetting to the top of the document.
    const firstOption = wrap.querySelector(".option");
    if (firstOption) {
      firstOption.focus({ preventScroll: true });
    }

    async function choose(value, btn) {
      if (wrap.classList.contains("answered")) return;
      wrap.classList.add("answered");

      const buttons = [...wrap.querySelectorAll(".option")];
      buttons.forEach((b) => (b.disabled = true));
      btn.classList.add("is-chosen");

      if (opts.correct != null) {
        const correct = String(opts.correct);
        buttons.forEach((b) => {
          const v = b.textContent;
          if (v === correct) b.classList.add("is-correct");
        });
        btn.classList.remove("is-chosen");
        btn.classList.add(String(value) === correct ? "is-correct" : "is-wrong");
      }

      ctx.onAnswer(opts.id, value);

      // Inline reveal lines (either for the chosen value or shared via "*").
      const reveal = opts.reveal || {};
      const lines = [
        ...(reveal[value] || []),
        ...(reveal["*"] || []),
      ];

      for (const l of lines) {
        await delay(LINE_DELAY);
        appendLine(stage, l, vars);
      }

      await delay(LINE_DELAY);
      showNav(stage, ctx);

      resolve();
    }
  });
}

function showNav(stage, ctx) {
  if (stage.querySelector(".next-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "next-wrap line";

  // Weaker "previous" button: available, but not the usual path.
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn btn--prev";
  prev.textContent = "<";
  prev.setAttribute("aria-label", "Föregående");
  prev.addEventListener("click", ctx.onBack, { once: true });
  if (!ctx.canBack) prev.hidden = true;
  wrap.appendChild(prev);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn btn--next";
  next.textContent = ">";
  next.setAttribute("aria-label", "Nästa");
  next.addEventListener("click", ctx.onDone, { once: true });
  wrap.appendChild(next);

  stage.appendChild(wrap);
  next.focus({ preventScroll: true });
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
