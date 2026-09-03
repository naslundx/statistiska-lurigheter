// variables.js
// Generates random values for a topic's variables and substitutes them
// (plus simple *emphasis*) into text.

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Resolve a topic's `variables` definition into concrete values.
 *
 * Rules:
 *   [min, max]  where both are numbers  -> inclusive random integer
 *   ["a", "b"]  (a list)                -> a random element of the list
 *
 * Called once per topic on page load (no statefulness beyond that).
 */
export function resolveVariables(defs) {
  const out = {};
  if (!defs) return out;

  for (const [key, def] of Object.entries(defs)) {
    if (
      Array.isArray(def) &&
      def.length === 2 &&
      typeof def[0] === "number" &&
      typeof def[1] === "number"
    ) {
      out[key] = randInt(def[0], def[1]);
    } else if (Array.isArray(def)) {
      out[key] = pick(def);
    } else {
      out[key] = def; // literal fallback
    }
  }
  return out;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Highlight colors cycled through so *emphasis* stays playful and multicolored.
const HL = [
  { bg: "#fff0a6", fg: "#7a5c00" },
  { bg: "#ffd9e6", fg: "#b02a6b" },
  { bg: "#d8ecff", fg: "#1d5fb0" },
  { bg: "#d7ffe9", fg: "#0f8a52" },
  { bg: "#efe1ff", fg: "#6a34c0" },
];

/**
 * Replace `$var` tokens with their values, escape HTML, then turn
 * `*emphasis*` into colored highlight spans.
 * Returns an HTML string.
 */
export function renderText(text, vars) {
  const withVars = String(text).replace(
    /\$([A-Za-z_]\w*)/g,
    (m, name) => (name in vars ? vars[name] : m)
  );

  const safe = escapeHtml(withVars);

  let i = 0;
  return safe.replace(/\*([^*]+)\*/g, (_, inner) => {
    const c = HL[i++ % HL.length];
    return `<span class="hl" style="--hl-bg:${c.bg};--hl-fg:${c.fg}">${inner}</span>`;
  });
}
