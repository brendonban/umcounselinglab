// Pure helpers for the booking page: which rooms suit a purpose and which are free.
import { ymd, pad } from "@/lib/api";
import { DOW } from "@/lib/ui";

export const purposeOf = (cfg, name) => cfg.purposes.find(p => p.name === name) || cfg.purposes[0];
export const roomsOf = (cfg, p) => cfg.rooms.filter(r => r.type === p.roomType);
export const roomById = (cfg, id) => cfg.rooms.find(r => r.id === id);

// "Rooms 2–8" when the numbers run on, otherwise "Rooms 1 & 10"
export function listRooms(rs) {
  const n = rs.map(r => r.id);
  const run = n.every((v, i) => i === 0 || +v === +n[i - 1] + 1);
  if (n.length === 1) return "Room " + n[0];
  if (run && n.length > 2) return "Rooms " + n[0] + "–" + n[n.length - 1];
  return "Rooms " + n.slice(0, -1).join(", ") + " & " + n[n.length - 1];
}

// Availability checks against { taken: Set, blocked: Set }.
export function makeSchedule(cfg, avail, rooms) {
  const isBlocked = (date, h, room) => {
    const b = avail.blocked, hh = pad(h);
    return b.has(date + "_" + hh + "_" + room) || b.has(date + "_" + hh + "_all") || b.has(date + "_all_" + room) || b.has(date + "_all_all");
  };
  const blockFree = (date, h, room) => !avail.taken.has(date + "_" + pad(h) + "_" + room) && !isBlocked(date, h, room);
  // A room works for a start when every hour of the span is a lab hour and free in that room.
  const spanFree = (date, start, n, room) => {
    for (let h = start; h < start + n; h++) if (!cfg.hours.includes(h) || !blockFree(date, h, room)) return false;
    return true;
  };
  const freeRooms = (date, start, n) => rooms.filter(r => spanFree(date, start, n, r.id));
  return { isBlocked, blockFree, freeRooms };
}

// Open days from minDaysAhead to daysAhead, as "YYYY-MM-DD".
export function buildDays(cfg) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + cfg.minDaysAhead);
  const last = new Date(); last.setHours(0, 0, 0, 0); last.setDate(last.getDate() + cfg.daysAhead);
  const out = [];
  while (d <= last) { if (cfg.openDays.includes(d.getDay())) out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}

// The chips under the page title.
export function facts(c) {
  const hrs = c.hours;
  return [
    c.openDays.length === 7 ? "Mon–Sun" : c.openDays.join() === "1,2,3,4,5" ? "Mon–Fri" : c.openDays.map(d => DOW[d]).join(", "),
    pad(Math.min(...hrs)) + ":00–" + pad(Math.max(...hrs) + 1) + ":00",
    "Book " + (c.minDaysAhead === 1 ? "1 day" : c.minDaysAhead + " days") + " ahead",
    c.rooms.length + " rooms",
  ];
}

export const expired = err => /sign in again/i.test((err && err.message) || "");
