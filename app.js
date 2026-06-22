"use strict";

const STORAGE_KEY = "upv-live-analysis-60-dunearn-v1";
const READING_KEYS = ["p1r1", "p1r2", "p1r3", "p2r1", "p2r2", "p2r3", "p3r1", "p3r2", "p3r3"];
const META_KEYS = ["block", "level", "zone", "locationId", "remarks"];
const CSV_HEADERS = [...META_KEYS, ...READING_KEYS];
const GROUPS = [
  ["C", "1st Storey", "C-L1"],
  ["M", "1st Storey", "M-L1"],
  ["C", "2nd Storey", "C-L2"],
  ["M", "2nd Storey", "M-L2"],
];

let rows = loadRows();
let analysis = null;

const tableBody = document.getElementById("tableBody");
const lowestBody = document.getElementById("lowestBody");
const groupBody = document.getElementById("groupBody");
const saveStatus = document.getElementById("saveStatus");

document.getElementById("addRowBtn").addEventListener("click", addRow);
document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
document.getElementById("importCsvInput").addEventListener("change", importCsv);
document.getElementById("clearBtn").addEventListener("click", clearReadings);
document.getElementById("copyLowestBtn").addEventListener("click", copyLowest);

renderTable();
recalculate();

function createDefaultRows() {
  const seeded = [];
  for (const [block, level, prefix] of GROUPS) {
    for (let i = 1; i <= 30; i += 1) {
      seeded.push(blankRow(block, level, `${prefix}-${String(i).padStart(2, "0")}`));
    }
  }
  return seeded;
}

function blankRow(block = "C", level = "1st Storey", locationId = "") {
  return {
    block,
    level,
    zone: "",
    locationId,
    remarks: "",
    p1r1: "",
    p1r2: "",
    p1r3: "",
    p2r1: "",
    p2r2: "",
    p2r3: "",
    p3r1: "",
    p3r2: "",
    p3r3: "",
  };
}

function loadRows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultRows();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeRow) : createDefaultRows();
  } catch {
    return createDefaultRows();
  }
}

function normalizeRow(row) {
  const clean = blankRow();
  for (const key of [...META_KEYS, ...READING_KEYS]) clean[key] = row[key] ?? "";
  clean.block = clean.block || "C";
  clean.level = clean.level || "1st Storey";
  return clean;
}

function saveRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  saveStatus.textContent = `Autosaved ${new Date().toLocaleTimeString()}`;
}

function renderTable() {
  tableBody.innerHTML = "";
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = String(index);

    tr.appendChild(selectCell(index, "block", ["C", "M"]));
    tr.appendChild(selectCell(index, "level", ["1st Storey", "2nd Storey"]));
    tr.appendChild(inputCell(index, "zone", "text"));
    tr.appendChild(inputCell(index, "locationId", "text"));
    for (const key of READING_KEYS) tr.appendChild(inputCell(index, key, "number"));
    tr.appendChild(outputCell("p1Avg"));
    tr.appendChild(outputCell("p2Avg"));
    tr.appendChild(outputCell("p3Avg"));
    tr.appendChild(outputCell("locationAvg"));
    tr.appendChild(outputCell("sd"));
    tr.appendChild(outputCell("cv"));
    tr.appendChild(outputCell("rank", "rankCell"));
    tr.appendChild(inputCell(index, "remarks", "text"));

    tableBody.appendChild(tr);
  });
}

function selectCell(rowIndex, key, options) {
  const td = document.createElement("td");
  td.className = "inputCell";
  const select = document.createElement("select");
  select.dataset.row = String(rowIndex);
  select.dataset.key = key;
  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  }
  select.value = rows[rowIndex][key];
  select.addEventListener("change", updateValue);
  td.appendChild(select);
  return td;
}

function inputCell(rowIndex, key, type) {
  const td = document.createElement("td");
  td.className = READING_KEYS.includes(key) || META_KEYS.includes(key) ? "inputCell" : "";
  const input = document.createElement("input");
  input.dataset.row = String(rowIndex);
  input.dataset.key = key;
  input.type = type;
  if (type === "number") {
    input.step = "0.01";
    input.min = "0";
    input.inputMode = "decimal";
  }
  input.value = rows[rowIndex][key] ?? "";
  input.addEventListener("input", updateValue);
  td.appendChild(input);
  return td;
}

function outputCell(key, extraClass = "") {
  const td = document.createElement("td");
  td.className = `outputCell ${extraClass}`;
  td.dataset.output = key;
  return td;
}

function updateValue(event) {
  const element = event.target;
  const rowIndex = Number(element.dataset.row);
  const key = element.dataset.key;
  rows[rowIndex][key] = element.value;
  recalculate();
  saveRows();
}

function addRow() {
  rows.push(blankRow("C", "1st Storey", `NEW-${String(rows.length + 1).padStart(3, "0")}`));
  renderTable();
  recalculate();
  saveRows();
}

function clearReadings() {
  if (!confirm("Clear all UPV readings and remarks? Location IDs will remain.")) return;
  rows = rows.map((row) => {
    const next = { ...row, remarks: "" };
    for (const key of READING_KEYS) next[key] = "";
    return next;
  });
  renderTable();
  recalculate();
  saveRows();
}

function readNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function avg(values) {
  const numeric = values.filter((value) => value !== null);
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function avgIfComplete(values, requiredCount) {
  const numeric = values.filter((value) => value !== null);
  if (numeric.length !== requiredCount) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function sampleSd(values) {
  const numeric = values.filter((value) => value !== null);
  if (numeric.length < 2) return null;
  const mean = avg(numeric);
  const variance = numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (numeric.length - 1);
  return Math.sqrt(variance);
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function recalculate() {
  const computedRows = rows.map((row, index) => {
    const values = READING_KEYS.map((key) => readNumber(row[key]));
    const p1 = avgIfComplete(values.slice(0, 3), 3);
    const p2 = avgIfComplete(values.slice(3, 6), 3);
    const p3 = avgIfComplete(values.slice(6, 9), 3);
    const locationAvg = p1 !== null && p2 !== null && p3 !== null ? avg([p1, p2, p3]) : null;
    const sd = locationAvg !== null ? sampleSd(values) : null;
    const cv = sd !== null && locationAvg ? sd / locationAvg : null;
    return { ...row, index, p1, p2, p3, locationAvg, sd, cv, rank: null };
  });

  const completed = computedRows
    .filter((row) => row.locationAvg !== null)
    .sort((a, b) => a.locationAvg - b.locationAvg || a.index - b.index);

  completed.forEach((row, index) => {
    row.rank = index + 1;
  });

  const values = completed.map((row) => row.locationAvg).sort((a, b) => a - b);
  const mean = avg(values);
  const sd = sampleSd(values);
  const median = percentile(values, 0.5);
  const p25 = percentile(values, 0.25);
  const p75 = percentile(values, 0.75);
  const r2 = normalPlotR2(values, mean, sd);

  analysis = {
    rows: computedRows,
    completed,
    lowestFive: completed.slice(0, 5),
    stats: {
      count: completed.length,
      mean,
      median,
      sd,
      p25,
      p75,
      min: values[0] ?? null,
      max: values[values.length - 1] ?? null,
      r2,
    },
  };

  updateTableOutputs();
  updateSummary();
  updateLowest();
  updateGroups();
  drawCharts();
}

function updateTableOutputs() {
  const rowElements = [...tableBody.querySelectorAll("tr")];
  for (const tr of rowElements) {
    const index = Number(tr.dataset.index);
    const row = analysis.rows[index];
    tr.classList.toggle("lowest", row.rank !== null && row.rank <= 5);
    tr.querySelector('[data-output="p1Avg"]').textContent = formatNumber(row.p1);
    tr.querySelector('[data-output="p2Avg"]').textContent = formatNumber(row.p2);
    tr.querySelector('[data-output="p3Avg"]').textContent = formatNumber(row.p3);
    tr.querySelector('[data-output="locationAvg"]').textContent = formatNumber(row.locationAvg);
    tr.querySelector('[data-output="sd"]').textContent = formatNumber(row.sd);
    tr.querySelector('[data-output="cv"]').textContent = formatPercent(row.cv);
    tr.querySelector('[data-output="rank"]').textContent = row.rank ?? "";
  }
}

function updateSummary() {
  const { stats } = analysis;
  setText("completedCount", String(stats.count));
  setText("meanValue", formatNumber(stats.mean));
  setText("medianValue", formatNumber(stats.median));
  setText("sdValue", formatNumber(stats.sd));
  setText("p25Value", formatNumber(stats.p25));
  setText("p75Value", formatNumber(stats.p75));
  setText("r2Value", formatNumber(stats.r2, 3));
  setText("minValue", formatNumber(stats.min));
}

function updateLowest() {
  lowestBody.innerHTML = "";
  if (!analysis.lowestFive.length) {
    const tr = document.createElement("tr");
    tr.className = "emptyRow";
    tr.innerHTML = '<td colspan="5">Enter complete 9-reading locations to generate the coring shortlist.</td>';
    lowestBody.appendChild(tr);
    return;
  }

  for (const row of analysis.lowestFive) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${escapeHtml(row.locationId)}</td>
      <td>${escapeHtml(row.block)}</td>
      <td>${escapeHtml(row.level)}</td>
      <td>${formatNumber(row.locationAvg)}</td>
    `;
    lowestBody.appendChild(tr);
  }
}

function updateGroups() {
  groupBody.innerHTML = "";
  const groupNames = GROUPS.map(([block, level]) => `${block} / ${level}`);
  for (const groupName of groupNames) {
    const [block, level] = groupName.split(" / ");
    const groupRows = analysis.completed.filter((row) => row.block === block && row.level === level);
    const values = groupRows.map((row) => row.locationAvg);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(groupName)}</td>
      <td>${values.length}</td>
      <td>${formatNumber(avg(values))}</td>
      <td>${formatNumber(sampleSd(values))}</td>
    `;
    groupBody.appendChild(tr);
  }
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function formatNumber(value, digits = 2) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : value.toFixed(digits);
}

function formatPercent(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalPdf(x, mean, sd) {
  if (!sd || sd <= 0) return null;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2);
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(x, mean, sd) {
  if (!sd || sd <= 0) return null;
  return 0.5 * (1 + erf((x - mean) / (sd * Math.sqrt(2))));
}

function inverseNormal(p, mean = 0, sd = 1) {
  if (p <= 0 || p >= 1 || !sd || sd <= 0) return null;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q;
  let r;
  let x;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    q = p - 0.5;
    r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  return mean + sd * x;
}

function normalPlotR2(sortedValues, mean, sd) {
  if (sortedValues.length < 3 || !sd || sd <= 0) return null;
  const expected = sortedValues.map((_, i) => inverseNormal((i + 0.5) / sortedValues.length, mean, sd));
  const actualMean = avg(sortedValues);
  const expectedMean = avg(expected);
  const numerator = sortedValues.reduce((sum, value, i) => sum + (value - actualMean) * (expected[i] - expectedMean), 0);
  const actualSs = sortedValues.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const expectedSs = expected.reduce((sum, value) => sum + (value - expectedMean) ** 2, 0);
  if (actualSs === 0 || expectedSs === 0) return null;
  const r = numerator / Math.sqrt(actualSs * expectedSs);
  return r * r;
}

function getBins(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(14, Math.max(6, Math.ceil(Math.sqrt(values.length)) + 3));
  const span = max - min || 0.5;
  const step = niceStep(span / binCount);
  const start = Math.floor((min - step * 0.5) / step) * step;
  const end = Math.ceil((max + step * 0.5) / step) * step;
  const bins = [];
  for (let upper = start + step; upper <= end + step * 0.1; upper += step) {
    bins.push({ lower: upper - step, upper, count: 0 });
  }
  for (const value of values) {
    const bin = bins.find((item, index) => value <= item.upper || index === bins.length - 1);
    if (bin) bin.count += 1;
  }
  return bins;
}

function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const scaled = raw / power;
  if (scaled <= 1) return power;
  if (scaled <= 2) return 2 * power;
  if (scaled <= 5) return 5 * power;
  return 10 * power;
}

function drawCharts() {
  const values = analysis.completed.map((row) => row.locationAvg).sort((a, b) => a - b);
  drawHistogram(values);
  drawCdf(values);
  drawQq(values);
}

function canvasSetup(id) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { canvas, ctx, width: rect.width, height: rect.height };
}

function clearChart(ctx, width, height, message) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#5f6f7a";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function drawAxes(ctx, plot) {
  ctx.strokeStyle = "#aebdc3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
}

function drawHistogram(values) {
  const { ctx, width, height } = canvasSetup("histCanvas");
  if (!values.length) {
    clearChart(ctx, width, height, "Enter complete locations to show distribution.");
    document.getElementById("histNote").textContent = "Waiting for readings";
    return;
  }

  const bins = getBins(values);
  const mean = analysis.stats.mean;
  const sd = analysis.stats.sd;
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  const plot = { left: 48, right: width - 18, top: 22, bottom: height - 42 };
  const xScale = (x) => plot.left + ((x - bins[0].lower) / (bins[bins.length - 1].upper - bins[0].lower)) * (plot.right - plot.left);
  const yScale = (y) => plot.bottom - (y / maxCount) * (plot.bottom - plot.top);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawAxes(ctx, plot);

  for (const bin of bins) {
    const x0 = xScale(bin.lower) + 2;
    const x1 = xScale(bin.upper) - 2;
    const y = yScale(bin.count);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(x0, y, Math.max(2, x1 - x0), plot.bottom - y);
  }

  if (sd && sd > 0) {
    ctx.strokeStyle = "#e87532";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = (bins[bins.length - 1].upper - bins[0].lower) / 100;
    for (let i = 0; i <= 100; i += 1) {
      const xValue = bins[0].lower + step * i;
      const expected = normalPdf(xValue, mean, sd) * values.length * (bins[0].upper - bins[0].lower);
      const x = xScale(xValue);
      const y = yScale(expected);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawChartLabels(ctx, plot, bins[0].lower, bins[bins.length - 1].upper, maxCount, "UPV", "Count");
  document.getElementById("histNote").textContent = `${values.length} completed location${values.length === 1 ? "" : "s"}`;
}

function drawCdf(values) {
  const { ctx, width, height } = canvasSetup("cdfCanvas");
  if (!values.length) {
    clearChart(ctx, width, height, "Enter complete locations to show cumulative distribution.");
    document.getElementById("cdfNote").textContent = "Waiting for readings";
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 0.5;
  const xMin = min - span * 0.08;
  const xMax = max + span * 0.08;
  const plot = { left: 48, right: width - 18, top: 22, bottom: height - 42 };
  const xScale = (x) => plot.left + ((x - xMin) / (xMax - xMin)) * (plot.right - plot.left);
  const yScale = (y) => plot.bottom - y * (plot.bottom - plot.top);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawAxes(ctx, plot);

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = xScale(value);
    const y = yScale((index + 1) / values.length);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (analysis.stats.sd && analysis.stats.sd > 0) {
    ctx.strokeStyle = "#e87532";
    ctx.beginPath();
    for (let i = 0; i <= 100; i += 1) {
      const xValue = xMin + ((xMax - xMin) * i) / 100;
      const cdf = normalCdf(xValue, analysis.stats.mean, analysis.stats.sd);
      const x = xScale(xValue);
      const y = yScale(cdf);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawChartLabels(ctx, plot, xMin, xMax, 1, "UPV", "Cumulative");
  document.getElementById("cdfNote").textContent = "Observed line compared with normal CDF";
}

function drawQq(values) {
  const { ctx, width, height } = canvasSetup("qqCanvas");
  if (values.length < 3 || !analysis.stats.sd || analysis.stats.sd <= 0) {
    clearChart(ctx, width, height, "Normal probability plot and R-squared need at least 3 varied completed locations.");
    document.getElementById("qqNote").textContent = "R-squared updates after 3 completed locations";
    return;
  }

  const expected = values.map((_, i) => inverseNormal((i + 0.5) / values.length, analysis.stats.mean, analysis.stats.sd));
  const allX = expected;
  const allY = values;
  const min = Math.min(...allX, ...allY);
  const max = Math.max(...allX, ...allY);
  const span = max - min || 0.5;
  const xMin = min - span * 0.08;
  const xMax = max + span * 0.08;
  const plot = { left: 54, right: width - 24, top: 24, bottom: height - 44 };
  const xScale = (x) => plot.left + ((x - xMin) / (xMax - xMin)) * (plot.right - plot.left);
  const yScale = (y) => plot.bottom - ((y - xMin) / (xMax - xMin)) * (plot.bottom - plot.top);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawAxes(ctx, plot);

  ctx.strokeStyle = "#b6c4ca";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(xScale(xMin), yScale(xMin));
  ctx.lineTo(xScale(xMax), yScale(xMax));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#0f766e";
  expected.forEach((xValue, index) => {
    const x = xScale(xValue);
    const y = yScale(values[index]);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  drawChartLabels(ctx, plot, xMin, xMax, xMax, "Expected normal quantile", "Actual sorted UPV");
  document.getElementById("qqNote").textContent = `R-squared ${formatNumber(analysis.stats.r2, 3)}`;
}

function drawChartLabels(ctx, plot, xMin, xMax, yMax, xLabel, yLabel) {
  ctx.fillStyle = "#5f6f7a";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(formatNumber(xMin), plot.left, plot.bottom + 18);
  ctx.fillText(formatNumber(xMax), plot.right, plot.bottom + 18);
  ctx.fillText(xLabel, (plot.left + plot.right) / 2, plot.bottom + 34);
  ctx.save();
  ctx.translate(14, (plot.top + plot.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  ctx.textAlign = "right";
  ctx.fillText(formatNumber(yMax), plot.left - 6, plot.top + 4);
  ctx.fillText("0", plot.left - 6, plot.bottom);
}

function exportCsv() {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((key) => csvEscape(row[key])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "60_Dunearn_UPV_Live_Data.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function parseCsv(text) {
  const rowsOut = [];
  let cell = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rowsOut.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rowsOut.push(row);
  return rowsOut.filter((item) => item.some((value) => value !== ""));
}

async function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const parsed = parseCsv(text);
  const headers = parsed[0] || [];
  const nextRows = parsed.slice(1).map((line) => {
    const row = blankRow();
    headers.forEach((header, index) => {
      if (CSV_HEADERS.includes(header)) row[header] = line[index] ?? "";
    });
    return normalizeRow(row);
  });
  if (nextRows.length) {
    rows = nextRows;
    renderTable();
    recalculate();
    saveRows();
  }
  event.target.value = "";
}

async function copyLowest() {
  const lines = [["Rank", "Location", "Block", "Level", "Avg UPV"]];
  for (const row of analysis.lowestFive) {
    lines.push([row.rank, row.locationId, row.block, row.level, formatNumber(row.locationAvg)]);
  }
  await navigator.clipboard.writeText(lines.map((line) => line.join("\t")).join("\n"));
}

window.addEventListener("resize", () => {
  if (analysis) drawCharts();
});
