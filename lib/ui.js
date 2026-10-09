// Small browser helpers shared by the pages.

let timer;
// A short message at the bottom of the screen.
export function toast(msg) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div"); el.id = "toast"; el.className = "toast";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = msg; el.hidden = false;
  clearTimeout(timer); timer = setTimeout(() => (el.hidden = true), 4000);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const pad2 = n => String(n).padStart(2, "0");
export const hh = h => pad2(h) + ":00";
export const span = (s, e) => hh(s) + "–" + hh(e);
// "Fri 9 Oct" (or "Fri 9 Oct 2026" with year).
export function niceDate(s, year) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DOW[dt.getDay()] + " " + d + " " + MON[m - 1] + (year ? " " + y : "");
}
export { DOW, MON };

// Download rows as a CSV file. rows = array of arrays; the first row is the header.
export function downloadCsv(filename, rows) {
  const cell = v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blob = new Blob(["﻿" + rows.map(r => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
