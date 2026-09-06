// graph.js
// Renders a simple graph as SVG. Supported:
//   - points  (in colors, optional error bars)
//   - line     (solid/dashed, in colors)
//   - bars     (bar chart; rainbow by default, or a fixed color)
//   - iconGrid (a grid of colored dots for proportions/base rates)
// Axes are drawn plainly, without labels or ticks.

const SVG_NS = "http://www.w3.org/2000/svg";

const COLORS = {
  blue: "#4d8bf0",
  red: "#ff5c72",
  green: "#33c481",
  orange: "#ff9f43",
  purple: "#a66cff",
  pink: "#ff6bcb",
  yellow: "#ffd23f",
  teal: "#22c1c3",
  grey: "#c8c8da",
  gray: "#c8c8da",
};

// Cycled through for rainbow bars.
const PALETTE = ["blue", "pink", "green", "orange", "purple", "teal", "red", "yellow"];

function color(name) {
  return COLORS[name] || name || COLORS.blue;
}

// Canvas geometry (viewBox units).
const W = 400;
const H = 330;
const PAD = { top: 26, right: 26, bottom: 52, left: 52 };

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

function svgText(x, y, text, opts = {}) {
  const t = el("text", {
    x,
    y,
    "text-anchor": opts.anchor || "middle",
    "font-size": opts.size || 13,
    fill: opts.fill || "#9a9ab0",
  });
  t.setAttribute("dominant-baseline", opts.baseline || "middle");
  if (opts.weight) t.setAttribute("font-weight", opts.weight);
  if (opts.rotate != null) t.setAttribute("transform", `rotate(${opts.rotate} ${x} ${y})`);
  t.textContent = text;
  return t;
}

// Smooth (non-linear) path through points using a Catmull-Rom -> Bezier spline.
function smoothPath(pts) {
  if (pts.length < 3) {
    return "M " + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ");
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Build a graph element. Two shapes are supported:
 *
 * Axis chart:
 *   { xRange, yRange,
 *     xLabel?, yLabel?,        // axis descriptions
 *     xEnds?, yEnds?,          // [minLabel, maxLabel]; default = the range values, "" hides one
 *     series: [
 *       { type: "points", color, data: [[x,y] | [x,y,error], ...] },
 *       { type: "line",   color, style: "dashed"?, smooth: true?, data: [[x,y], ...] },
 *       { type: "bars",   color?, barWidth?, data: [[x, height], ...] }
 *   ] }
 *
 * Icon grid (proportions / base rates):
 *   { iconGrid: { cols, rows?, groups: [{ color, count }, ...] } }
 */
export function createGraph(spec) {
  const card = document.createElement("div");
  card.className = "graph-card line";
  card.appendChild(spec.iconGrid ? renderIconGrid(spec.iconGrid) : renderAxisChart(spec));
  if (Array.isArray(spec.legend) && spec.legend.length) {
    card.appendChild(renderLegend(spec.legend));
  }
  return card;
}

// A caption under the chart: swatches mapped to labels.
// Each item: { color, label, type?: "dot" | "line" | "dashed" }
function renderLegend(items) {
  const wrap = document.createElement("div");
  wrap.className = "graph-legend";
  items.forEach((it) => {
    const item = document.createElement("span");
    item.className = "graph-legend__item";

    const kind = it.type === "line" || it.type === "dashed" ? it.type : "dot";
    const swatch = document.createElement("span");
    swatch.className = `graph-legend__swatch graph-legend__swatch--${kind}`;
    swatch.style.setProperty("--sw", color(it.color));

    const label = document.createElement("span");
    label.textContent = it.label;

    item.append(swatch, label);
    wrap.appendChild(item);
  });
  return wrap;
}

function renderAxisChart(spec) {
  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "graph",
    role: "img",
    "aria-label": "Diagram",
  });

  const [xMin, xMax] = spec.xRange || [0, 100];
  const [yMin, yMax] = spec.yRange || [0, 100];

  const plotL = PAD.left;
  const plotR = W - PAD.right;
  const plotT = PAD.top;
  const plotB = H - PAD.bottom;

  const sx = (x) => plotL + ((x - xMin) / (xMax - xMin)) * (plotR - plotL);
  const sy = (y) => plotB - ((y - yMin) / (yMax - yMin)) * (plotB - plotT);

  // --- Axes (no ticks, no labels) ---
  // Set `"axes": false` in the spec to hide the axis lines, arrows and
  // endpoint values entirely (e.g. for a plain scatter of dots).
  const showAxes = spec.axes !== false;
  const axisColor = "#c9c9dd";
  if (showAxes) {
    svg.appendChild(el("line", {
      x1: plotL, y1: plotB, x2: plotR + 4, y2: plotB,
      stroke: axisColor, "stroke-width": 3, "stroke-linecap": "round",
    }));
    svg.appendChild(el("line", {
      x1: plotL, y1: plotB, x2: plotL, y2: plotT - 4,
      stroke: axisColor, "stroke-width": 3, "stroke-linecap": "round",
    }));
    svg.appendChild(el("polygon", {
      points: `${plotR + 4},${plotB} ${plotR - 4},${plotB - 5} ${plotR - 4},${plotB + 5}`,
      fill: axisColor,
    }));
    svg.appendChild(el("polygon", {
      points: `${plotL},${plotT - 4} ${plotL - 5},${plotT + 4} ${plotL + 5},${plotT + 4}`,
      fill: axisColor,
    }));

    // --- Axis endpoint values (start/end only; no intermediate steps) ---
    const [xMinL, xMaxL] = spec.xEnds || [String(xMin), String(xMax)];
    const [yMinL, yMaxL] = spec.yEnds || [String(yMin), String(yMax)];
    if (xMinL) svg.appendChild(svgText(plotL, plotB + 17, xMinL, { anchor: "start", baseline: "hanging" }));
    if (xMaxL) svg.appendChild(svgText(plotR, plotB + 17, xMaxL, { anchor: "end", baseline: "hanging" }));
    if (yMinL) svg.appendChild(svgText(plotL - 9, plotB, yMinL, { anchor: "end" }));
    if (yMaxL) svg.appendChild(svgText(plotL - 9, plotT, yMaxL, { anchor: "end" }));
  }

  // --- Axis descriptions ---
  if (showAxes && spec.xLabel) {
    svg.appendChild(svgText((plotL + plotR) / 2, H - 6, spec.xLabel, {
      weight: 600, fill: "#6c6c86", size: 14, baseline: "auto",
    }));
  }
  if (showAxes && spec.yLabel) {
    svg.appendChild(svgText(13, (plotT + plotB) / 2, spec.yLabel, {
      weight: 600, fill: "#6c6c86", size: 14, rotate: -90,
    }));
  }

  // --- Series ---
  let popIndex = 0;
  (spec.series || []).forEach((series, si) => {
    const c = color(series.color);

    if (series.type === "line") {
      const px = series.data.map(([x, y]) => [sx(x), sy(y)]);
      const d = series.smooth
        ? smoothPath(px)
        : "M " + px.map((p) => `${p[0]} ${p[1]}`).join(" L ");
      const line = el("path", {
        d,
        fill: "none",
        stroke: c,
        "stroke-width": 5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "ln",
      });
      if (series.style === "dashed") line.setAttribute("stroke-dasharray", "12 10");
      line.style.animationDelay = `${0.15 + si * 0.15}s`;
      svg.appendChild(line);
    } else if (series.type === "bars") {
      const bw = series.barWidth || 0.8;
      const halfPx = ((bw / (xMax - xMin)) * (plotR - plotL)) / 2;
      const baseY = sy(yMin);
      series.data.forEach(([x, h], i) => {
        const topY = sy(h);
        const fill = series.color ? c : color(PALETTE[i % PALETTE.length]);
        const rect = el("rect", {
          x: sx(x) - halfPx,
          y: topY,
          width: halfPx * 2,
          height: Math.max(0, baseY - topY),
          rx: 5,
          fill,
          class: "br",
        });
        rect.style.animationDelay = `${0.15 + i * 0.05}s`;
        svg.appendChild(rect);
      });
    } else {
      // points; each datum is [x, y] or [x, y, error] for an error bar
      series.data.forEach((d) => {
        const [x, y, err] = d;

        if (err != null) {
          const capW = 7;
          const yTop = sy(y + err);
          const yBot = sy(y - err);
          const px = sx(x);
          svg.appendChild(el("line", {
            x1: px, y1: yTop, x2: px, y2: yBot,
            stroke: c, "stroke-width": 3, "stroke-linecap": "round", class: "ln",
          }));
          svg.appendChild(el("line", {
            x1: px - capW, y1: yTop, x2: px + capW, y2: yTop,
            stroke: c, "stroke-width": 3, "stroke-linecap": "round", class: "ln",
          }));
          svg.appendChild(el("line", {
            x1: px - capW, y1: yBot, x2: px + capW, y2: yBot,
            stroke: c, "stroke-width": 3, "stroke-linecap": "round", class: "ln",
          }));
        }

        const dot = el("circle", {
          cx: sx(x),
          cy: sy(y),
          r: 8,
          fill: c,
          stroke: "#fff",
          "stroke-width": 2.5,
          class: "pt",
        });
        dot.style.animationDelay = `${0.2 + popIndex * 0.04}s`;
        popIndex++;
        svg.appendChild(dot);
      });
    }
  });

  return svg;
}

function renderIconGrid(cfg) {
  const cols = cfg.cols || 10;
  const groups = cfg.groups || [];
  const total = groups.reduce((s, g) => s + g.count, 0);
  const rows = cfg.rows || Math.max(1, Math.ceil(total / cols));

  const gw = W;
  const gh = Math.round((W * rows) / cols);
  const cellW = gw / cols;
  const cellH = gh / rows;
  const r = Math.min(cellW, cellH) * 0.32;

  const svg = el("svg", {
    viewBox: `0 0 ${gw} ${gh}`,
    class: "graph",
    role: "img",
    "aria-label": "Rutnät",
  });

  // Flatten groups into a per-dot color list.
  const colorsFlat = [];
  groups.forEach((g) => {
    for (let k = 0; k < g.count; k++) colorsFlat.push(color(g.color));
  });

  colorsFlat.forEach((col, idx) => {
    const cxi = idx % cols;
    const cyi = Math.floor(idx / cols);
    const dot = el("circle", {
      cx: cellW * (cxi + 0.5),
      cy: cellH * (cyi + 0.5),
      r,
      fill: col,
      class: "pt",
    });
    dot.style.animationDelay = `${0.15 + idx * 0.012}s`;
    svg.appendChild(dot);
  });

  return svg;
}
