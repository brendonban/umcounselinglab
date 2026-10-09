/* Data layer: Firebase (Firestore + Google sign-in), or a local demo when no Firebase settings are set.
   Every page talks to the lab through the `API` object exported at the bottom of this file.
   Only call these functions in the browser (inside effects or event handlers). */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut as fbSignOut,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, getDocsFromServer, setDoc, updateDoc, addDoc, query, where,
  runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { SETTINGS } from "./settings";

// Firebase settings come from environment variables (see .env.example and README.md).
const FB = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};
export const DEMO = !FB.apiKey;

// Booking settings. The same limits are enforced on the server in firebase/firestore.rules,
// so if you change hours, rooms or purposes here, change them there too.

const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const keys = b => { const o = []; for (let h = b.hour; h < b.hour + b.hours; h++) o.push(b.date + "_" + pad(h) + "_" + b.room); return o; };
const roomName = id => "Room " + id;

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
}
function isPast(date, hour) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour) <= new Date();
}
function makeCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function domainOk(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const d = email.split("@")[1];
  return !SETTINGS.allowedDomains.length || SETTINGS.allowedDomains.includes(d);
}
function demoEmail(token) {
  const t = String(token || "");
  if (!t.startsWith("demo.")) throw new Error("Please sign in again to book.");
  return t.slice(5);
}
function demoProfile(email) {
  const saved = (store("lab-demo-profiles") || {})[email];
  if (saved) return { ...saved, saved: true };
  const list = store("lab-demo-bookings3") || [];
  const b = list.filter(x => x.email === email).pop();
  return b ? { name: b.name, studentId: b.studentId, phone: b.phone, programme: "", supervisor: b.supervisor || "", saved: false } : null;
}

// Made-up bookings for the demo admin console (kept in this browser so status changes stick).
function adminSample() {
  let list = store("lab-demo-admin-sample");
  if (list && list.length) return list;
  const names = [["Nur Aisyah Rahman", "S2101234"], ["Daniel Lee", "S2102457"], ["Priya Nair", "S2100981"], ["Muhammad Hafiz", "S2103310"], ["Chloe Tan", "S2101876"], ["Siti Khadijah", "S2104402"], ["Arjun Kumar", "S2100555"], ["Farah Ismail", "S2102019"]];
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const purposes = SETTINGS.purposes, hrs = SETTINGS.hours;
  list = []; const used = new Set();
  for (let off = -10; off <= 6; off++) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off); const date = ymd(d);
    const n = 4 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const p = purposes[rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2 + Math.floor(rnd() * 3)];
      const rooms = SETTINGS.rooms.filter(r => r.type === p.roomType);
      const room = rooms[Math.floor(rnd() * rooms.length)].id;
      const hours = p.roomType === "group" ? 2 : 1;
      const hour = hrs[Math.floor(rnd() * (hrs.length - hours + 1))];
      const ks = []; for (let h = hour; h < hour + hours; h++) ks.push(date + "_" + pad(h) + "_" + room);
      if (ks.some(k => used.has(k))) continue; ks.forEach(k => used.add(k));
      const [name, sid] = names[Math.floor(rnd() * names.length)];
      const past = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour + hours) <= new Date();
      const r = rnd();
      const status = past ? (r < 0.55 ? "Attended" : r < 0.85 ? "Confirmed" : r < 0.93 ? "No-show" : "Cancelled") : (r < 0.9 ? "Confirmed" : "Cancelled");
      list.push({ code: "S" + String(list.length + 101), date, hour, hours, room, name, studentId: sid, email: name.split(" ")[0].toLowerCase() + "@siswa.um.edu.my", phone: "", purpose: p.name, people: hours === 2 ? 5 : 2, supervisor: rnd() < 0.5 ? "Dr Lim" : "", notes: "", status, bookedAt: "", justification: "" });
    }
  }
  store("lab-demo-admin-sample", list);
  return list;
}

const demo = {
  async config() { return SETTINGS; },
  async availability() {
    const list = (store("lab-demo-bookings3") || []).filter(b => b.status === "Confirmed");
    const sample = adminSample().filter(b => b.status === "Confirmed" || b.status === "Attended");
    const closures = store("lab-demo-closures") || [];
    return { taken: list.flatMap(keys).concat(sample.flatMap(keys)), blocked: closures.map(c => c.date + "_" + (c.hour == null ? "all" : pad(c.hour)) + "_" + (c.room || "all")) };
  },
  // Demo sign-in: type any UM email. The live site uses "Continue with Google" instead.
  async signIn(p) {
    const email = String((p && p.email) || "").trim().toLowerCase();
    if (!domainOk(email)) throw new Error("Sign in with your UM email (" + SETTINGS.allowedDomains.map(d => "@" + d).join(" or ") + ").");
    const a = { token: "demo." + email, email, profile: demoProfile(email) };
    Auth.set(a); return a;
  },
  async signOut() { Auth.clear(); },
  async signInError() { return ""; },
  async me(p) { const email = demoEmail(p.token); return { email, profile: demoProfile(email), admin: true }; },
  // Demo admin console: everyone signed in counts as an admin, and made-up bookings fill the tables.
  async adminData(p) {
    demoEmail(p.token);
    const mine = (store("lab-demo-bookings3") || []).map(b => ({ code: b.code, date: b.date, hour: b.hour, end: b.hour + b.hours, room: roomName(b.room), roomId: b.room, name: b.name, studentId: b.studentId, email: b.email, phone: b.phone || "", purpose: b.purpose, people: b.people || 1, supervisor: b.supervisor || "", notes: b.notes || "", status: b.status, bookedAt: "", justification: b.justification || "" }));
    const sample = adminSample().map(b => ({ ...b, end: b.hour + b.hours, room: roomName(b.room), roomId: b.room }));
    const closures = (store("lab-demo-closures") || []).map((c, i) => ({ ...c, row: i }));
    const profiles = store("lab-demo-profiles") || {};
    return { bookings: mine.concat(sample), closures, profiles, sample: true };
  },
  async adminSetStatus(p) {
    demoEmail(p.token);
    for (const key of ["lab-demo-bookings3", "lab-demo-admin-sample"]) {
      const list = store(key) || [];
      const b = list.find(x => x.code === p.code);
      if (b) {
        if (p.status === "Confirmed" && b.status === "Cancelled") {
          const all = (store("lab-demo-bookings3") || []).concat(store("lab-demo-admin-sample") || []);
          if (all.some(x => x !== b && x.code !== b.code && x.status === "Confirmed" && keys(x).some(k => keys(b).includes(k)))) throw new Error("That time has been booked by someone else since, so it can't be restored.");
        }
        b.status = p.status; store(key, list); return { ok: true };
      }
    }
    throw new Error("Booking not found.");
  },
  async adminBlock(p) {
    demoEmail(p.token);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) throw new Error("Pick a date.");
    const list = store("lab-demo-closures") || [];
    list.push({ date: p.date, hour: p.hour === "" || p.hour == null ? null : +p.hour, room: p.room || null, reason: p.reason || "" });
    store("lab-demo-closures", list); return { ok: true };
  },
  async adminTickets(p) {
    demoEmail(p.token);
    let list = store("lab-demo-admin-tickets2");
    if (!list) {
      const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) + " " + pad(9 + (n * 3) % 9) + ":" + pad((n * 17) % 60); };
      list = [
        { id: "T-SAMPLE1", at: day(0), status: "Open", type: "Bug or error", subject: "Confirm booking button greyed out", message: "I picked a room and time but the Confirm booking button stays grey.", steps: "1. Chose Group counselling, 2 hours\n2. Picked Room 1 at 19:00\n3. Button doesn't work", page: "Booking", name: "Chloe Tan", email: "chloe@siswa.um.edu.my", signedIn: "chloe@siswa.um.edu.my", ua: "Safari on iPhone" },
        { id: "T-SAMPLE2", at: day(1), status: "Open", type: "Sign-in problem", subject: "Google sign-in says wrong account", message: "I tapped Continue with Google but it picked my personal Gmail and turned me away. How do I switch to my UM account?", steps: "", page: "Sign-in", name: "Arjun Kumar", email: "arjun@siswa365.um.edu.my", signedIn: "", ua: "Chrome on Android" },
        { id: "T-SAMPLE3", at: day(3), status: "In progress", type: "Suggestion", subject: "Weekly repeat bookings", message: "My practicum client comes every Tuesday at 10. Could I book the same slot for the whole semester?", steps: "", page: "Booking", name: "Priya Nair", email: "priya@siswa.um.edu.my", signedIn: "priya@siswa.um.edu.my", ua: "Chrome on Windows" },
        { id: "T-SAMPLE4", at: day(6), status: "Closed", type: "Booking problem", subject: "Hours missing from my profile", message: "Last week's session isn't in my practicum hours.", steps: "", page: "My profile", name: "Daniel Lee", email: "daniel@siswa.um.edu.my", signedIn: "daniel@siswa.um.edu.my", ua: "Safari on Mac" },
      ];
      store("lab-demo-admin-tickets2", list);
    }
    const mine = (store("lab-demo-tickets") || []).map(t => ({ ...t, at: t.at || "", status: t.status || "Open", signedIn: "", ua: (t.ua || "").slice(0, 60) }));
    return { tickets: mine.concat(list).map((t, i) => ({ ...t, row: i })), sample: true };
  },
  async adminSetTicket(p) {
    demoEmail(p.token);
    for (const key of ["lab-demo-tickets", "lab-demo-admin-tickets2"]) {
      const list = store(key) || []; const t = list.find(x => x.id === p.id);
      if (t) { t.status = p.status; store(key, list); return { ok: true }; }
    }
    throw new Error("Ticket not found.");
  },
  async adminSurvey(p) {
    demoEmail(p.token);
    let sample = store("lab-demo-admin-survey5");
    if (!sample) {
      let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      const pick = arr => arr[Math.floor(rnd() * arr.length)];
      const issues = ["Finding the right day tab", "Seeing which rooms are free", "My booking was overwritten or removed", "Everyone can see my phone number and email", "Cancelling through WhatsApp or the person in charge", "No reminder before my session", "Hard to use on my phone"];
      const wants = ["Add my booking to my Google or Outlook calendar automatically", "Book the same room and time every week for the semester", "Get an email when a fully booked time becomes free", "Change my booking's time or room without cancelling first", "Extend my session by an hour if the room is still free", "See photos, size and equipment for each room before booking", "Email my practicum hours summary to my supervisor"];
      const comments = ["Let us see all free rooms on one page.", "Please hide our phone numbers.", "Someone deleted my booking last week.", "Too many tabs, I always open the wrong day.", "A reminder the night before would help.", "", "", "", "Booking on my phone is really fiddly."];
      sample = Array.from({ length: 34 }, (_, i) => {
        const n = 1 + Math.floor(rnd() * 3), set = new Set(); while (set.size < n) set.add(issues[Math.floor(Math.pow(rnd(), 1.6) * issues.length)]);
        const d = new Date(); d.setDate(d.getDate() - Math.floor(i / 3));
        return { "Submitted at": ymd(d), level: rnd() < 0.68 ? "Undergraduate" : rnd() < 0.85 ? "Postgraduate" : "Lecturer / supervisor",
          freq: pick(["A few times a semester", "About monthly", "Weekly", "Weekly", "Several times a week", "Not yet"]),
          ease: 1 + Math.min(4, Math.floor(Math.pow(rnd(), 1.3) * 4.2)), issues: rnd() < 0.08 ? "Nothing, it works fine" : [...set].join("; "), other: pick(comments),
          want: (() => { const w = new Set(); const n2 = 1 + Math.floor(rnd() * 3); while (w.size < n2) w.add(wants[Math.floor(Math.pow(rnd(), 1.4) * wants.length)]); return [...w].join("; "); })(),
          switch: rnd() < 0.7 ? "Yes" : rnd() < 0.75 ? "Maybe" : "No, the sheet is fine" };
      });
      store("lab-demo-admin-survey5", sample);
    }
    const mine = (store("lab-demo-survey") || []).map(x => ({ "Submitted at": ymd(new Date()), ...(x.answers || {}) }));
    return { responses: mine.concat(sample), sample: true };
  },
  async adminUnblock(p) {
    demoEmail(p.token);
    const list = store("lab-demo-closures") || []; list.splice(+p.row, 1); store("lab-demo-closures", list); return { ok: true };
  },
  async saveProfile(p) {
    const email = demoEmail(p.token);
    const d = { name: String(p.name || "").trim(), studentId: String(p.studentId || "").trim(), phone: String(p.phone || "").trim(), programme: String(p.programme || "").trim(), supervisor: String(p.supervisor || "").trim() };
    if (!d.name || !d.studentId) throw new Error("Fill in your name and matric number.");
    const all = store("lab-demo-profiles") || {}; all[email] = d; store("lab-demo-profiles", all);
    return { profile: { ...d, saved: true } };
  },
  async book(p) {
    p = { ...p, email: demoEmail(p.token) }; delete p.token;
    const list = store("lab-demo-bookings3") || [];
    const want = keys(p);
    const earliest = new Date(); earliest.setHours(0, 0, 0, 0); earliest.setDate(earliest.getDate() + SETTINGS.minDaysAhead);
    if (p.date < ymd(earliest)) throw new Error("Bookings must be made at least one day in advance.");
    if (list.concat(adminSample()).some(b => (b.status === "Confirmed" || b.status === "Attended") && keys(b).some(k => want.includes(k)))) throw new Error(roomName(p.room) + " was just booked by someone else for part of that time. Pick another room or time.");
    const mine = list.filter(b => b.status === "Confirmed" && (b.email === p.email || b.studentId.toLowerCase() === p.studentId.toLowerCase()) && !isPast(b.date, b.hour));
    if (mine.length >= SETTINGS.maxUpcoming) throw new Error("You already have " + SETTINGS.maxUpcoming + " upcoming bookings. Contact the person in charge if you need another.");
    const code = makeCode();
    list.push({ ...p, code, status: "Confirmed" });
    store("lab-demo-bookings3", list);
    return { code, emailed: false, start: p.hour, end: p.hour + p.hours, room: roomName(p.room) };
  },
  async lookup(p) {
    const email = demoEmail(p.token);
    const list = store("lab-demo-bookings3") || [];
    return { bookings: list.filter(b => b.email === email && b.status === "Confirmed" && !isPast(b.date, b.hour)).map(b => ({ date: b.date, hour: b.hour, end: b.hour + b.hours, room: roomName(b.room), purpose: b.purpose, code: b.code })) };
  },
  async cancel(p) {
    const email = demoEmail(p.token);
    const list = store("lab-demo-bookings3") || [];
    const b = list.find(x => x.code === p.code && x.email === email);
    if (!b) throw new Error("We couldn't find that booking on your account.");
    if (b.status !== "Confirmed") throw new Error("This booking is already cancelled.");
    if (isPast(b.date, b.hour)) throw new Error("This session has already started, so it can't be cancelled online.");
    b.status = "Cancelled"; store("lab-demo-bookings3", list);
    return { ok: true };
  },
  async hours(p) {
    const email = demoEmail(p.token);
    const list = (store("lab-demo-bookings3") || []).filter(b => b.email === email && b.status === "Confirmed" && isPast(b.date, b.hour + b.hours));
    let sessions = list.map(b => ({ date: b.date, hour: b.hour, end: b.hour + b.hours, hours: b.hours, room: roomName(b.room), purpose: b.purpose, status: "Confirmed", code: b.code, people: b.people || 1 }));
    let sample = false;
    if (!sessions.length) {
      // Demo only: show a few made-up past sessions so the page has something to display.
      sample = true;
      const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
      sessions = [
        { date: day(2), hour: 10, end: 11, hours: 1, room: "Room 3", purpose: "Individual counselling session", status: "Attended", code: "DEMO01", people: 2 },
        { date: day(5), hour: 14, end: 16, hours: 2, room: "Room 1", purpose: "Group counselling session", status: "Attended", code: "DEMO02", people: 6 },
        { date: day(8), hour: 9, end: 10, hours: 1, room: "Room 5", purpose: "Individual counselling session", status: "Confirmed", code: "DEMO03", people: 2 },
        { date: day(12), hour: 15, end: 16, hours: 1, room: "Room 2", purpose: "Role-play / skills practice", status: "Confirmed", code: "DEMO04", people: 3 },
        { date: day(15), hour: 11, end: 12, hours: 1, room: "Room 7", purpose: "Supervision session", status: "Attended", code: "DEMO05", people: 2 },
      ];
    }
    const totals = {};
    SETTINGS.purposes.forEach(x => (totals[x.name] = { hours: 0, sessions: 0 }));
    sessions.forEach(s => { totals[s.purpose] = totals[s.purpose] || { hours: 0, sessions: 0 }; totals[s.purpose].hours += s.hours; totals[s.purpose].sessions++; });
    sessions.sort((x, y) => (x.date + pad(x.hour) < y.date + pad(y.hour) ? 1 : -1));
    return { email, sessions, totals, total: sessions.reduce((t, x) => t + x.hours, 0), sample };
  },
  async ticket(p) {
    if (p.website) return { id: "T-OK" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "")) throw new Error("Enter an email so we can reply to you.");
    if ((p.subject || "").trim().length < 3) throw new Error("Add a short subject.");
    if ((p.message || "").trim().length < 10) throw new Error("Tell us a bit more about what happened.");
    const d = new Date(), id = "T-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + makeCode().slice(0, 4);
    const list = store("lab-demo-tickets") || []; list.push({ id, ...p, token: undefined }); store("lab-demo-tickets", list);
    return { id, demo: true };
  },
  async survey(p) {
    const list = store("lab-demo-survey") || []; list.push(p); store("lab-demo-survey", list);
    return { ok: true };
  },
};

// ================================================================ live: Firebase
const GONE = "Please sign in again.";
let booted = null;
let pendingError = "";
function boot() {
  if (booted) return booted;
  booted = (async () => {
    const app = getApps()[0] || initializeApp(FB);
    const auth = getAuth(app), db = getFirestore(app);
    const f = { auth, db, now: () => serverTimestamp() };
    // Coming back from a redirect sign-in (used when a popup is blocked).
    try {
      const r = await getRedirectResult(auth);
      if (r && r.user) { await finishSignIn(f, r.user); }
    } catch (e) { pendingError = e.message && !e.code ? e.message : friendly(e); }
    await new Promise(res => { const off = onAuthStateChanged(auth, () => { off(); res(); }); });
    // Forget a remembered sign-in that Firebase no longer has.
    if (!auth.currentUser && Auth.get()) Auth.clear();
    return f;
  })();
  return booted;
}
async function user() {
  const f = await boot();
  const u = f.auth.currentUser;
  if (!u) { Auth.clear(); throw new Error(GONE); }
  return { ...f, u, email: (u.email || "").toLowerCase() };
}
function friendly(e) {
  const code = (e && e.code) || "";
  if (code === "permission-denied") return "That wasn't allowed. Reload the page and try again.";
  if (code === "unavailable" || code === "auth/network-request-failed") return "Couldn't reach the booking service. Check your connection and try again.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was closed before it finished.";
  if (code === "auth/unauthorized-domain") return "This website's address isn't allowed to sign in yet. Add it under Authentication › Settings › Authorised domains in Firebase.";
  return (e && e.message) || "Something went wrong.";
}
const ref = (f, c, id) => doc(f.db, c, id);
// Give up after `ms` instead of waiting forever when the network is down.
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Couldn't reach the booking service. Check your connection and try again.")), ms))]);
const col = (f, c) => collection(f.db, c);
async function isAdminEmail(f, email) {
  try { return (await getDoc(ref(f, "admins", email))).exists(); } catch (e) { return false; }
}
async function readProfile(f, u) {
  const d = await getDoc(ref(f, "profiles", u.uid));
  if (d.exists()) { const p = d.data(); return { name: p.name, studentId: p.studentId, phone: p.phone || "", programme: p.programme || "", supervisor: p.supervisor || "", saved: true }; }
  // No saved profile yet: borrow the details from their latest booking.
  const bs = (await myBookings(f, u)).sort((x, y) => (x.bookedAtMs < y.bookedAtMs ? 1 : -1));
  const b = bs[0];
  return b ? { name: b.name, studentId: b.studentId, phone: b.phone || "", programme: "", supervisor: b.supervisor || "", saved: false } : null;
}
async function finishSignIn(f, u) {
  const email = (u.email || "").toLowerCase();
  const admin = await isAdminEmail(f, email);
  if (!domainOk(email) && !admin) {
    await fbSignOut(f.auth); Auth.clear();
    throw new Error("Use your UM Google account (" + SETTINGS.allowedDomains.map(d => "@" + d).join(" or ") + "). You picked " + email + ".");
  }
  const a = { token: "firebase", email, profile: await readProfile(f, u), admin };
  Auth.set(a); return a;
}
const tsMs = t => (t && t.toMillis ? t.toMillis() : 0);
const stamp = t => { if (!t || !t.toDate) return ""; const d = t.toDate(); return ymd(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
function shape(d) {
  const b = d.data();
  return { ...b, code: d.id, end: b.hour + b.hours, roomId: b.room, room: roomName(b.room), people: b.people || 1, phone: b.phone || "", supervisor: b.supervisor || "", notes: b.notes || "", justification: b.justification || "", bookedAt: stamp(b.bookedAt), bookedAtMs: tsMs(b.bookedAt) };
}
async function myBookings(f, u) {
  const q = await getDocs(query(col(f, "bookings"), where("uid", "==", u.uid)));
  return q.docs.map(shape);
}

const live = {
  config: async () => SETTINGS,

  async availability() {
    const f = await boot();
    const from = new Date(); from.setDate(from.getDate() - 1);
    const to = new Date(); to.setDate(to.getDate() + SETTINGS.daysAhead + 1);
    const range = c => query(col(f, c), where("date", ">=", ymd(from)), where("date", "<=", ymd(to)));
    // Always ask the server: an offline cache would wrongly show every room as free.
    const [sq, cq] = await withTimeout(Promise.all([getDocsFromServer(range("slots")), getDocsFromServer(range("closures"))]), 10000);
    const taken = sq.docs.map(d => d.id), blocked = [];
    // Closure keys look like "14_3", "14_all", "all_3" or "all_all"; the pages expect "date_14_3" and so on.
    cq.forEach(d => Object.keys(d.data().items || {}).forEach(k => blocked.push(d.id + "_" + k)));
    return { taken, blocked };
  },

  async signIn() {
    const f = await boot();
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    let cred;
    try { cred = await signInWithPopup(f.auth, p); }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") { await signInWithRedirect(f.auth, p); return new Promise(() => {}); }
      throw new Error(friendly(e));
    }
    return finishSignIn(f, cred.user);
  },
  async signOut() { Auth.clear(); try { const f = await boot(); await fbSignOut(f.auth); } catch (e) {} },
  async signInError() { await boot().catch(() => {}); const m = pendingError; pendingError = ""; return m; },

  async me() {
    const f = await user();
    return { email: f.email, profile: await readProfile(f, f.u), admin: await isAdminEmail(f, f.email) };
  },

  async saveProfile(p) {
    const f = await user();
    const d = { email: f.email, name: String(p.name || "").trim(), studentId: String(p.studentId || "").trim(), phone: String(p.phone || "").trim(), programme: String(p.programme || "").trim(), supervisor: String(p.supervisor || "").trim(), updatedAt: f.now() };
    if (d.name.length < 2 || d.studentId.length < 3) throw new Error("Fill in your name and matric number.");
    try { await setDoc(ref(f, "profiles", f.u.uid), d); } catch (e) { throw new Error(friendly(e)); }
    const { email, updatedAt, ...profile } = d;
    return { profile: { ...profile, saved: true } };
  },

  async book(p) {
    const f = await user();
    const earliest = new Date(); earliest.setHours(0, 0, 0, 0); earliest.setDate(earliest.getDate() + SETTINGS.minDaysAhead);
    if (p.date < ymd(earliest)) throw new Error("Bookings must be made at least one day in advance.");
    const mine = (await myBookings(f, f.u)).filter(b => b.status === "Confirmed" && !isPast(b.date, b.hour));
    if (mine.length >= SETTINGS.maxUpcoming) throw new Error("You already have " + SETTINGS.maxUpcoming + " upcoming bookings. Contact the person in charge if you need another.");
    const slots = keys(p);
    const data = {
      uid: f.u.uid, email: f.email, date: p.date, hour: +p.hour, hours: +p.hours, room: String(p.room), purpose: p.purpose,
      name: String(p.name || "").trim(), studentId: String(p.studentId || "").trim(), phone: String(p.phone || "").trim(),
      people: Math.max(1, Math.min(12, parseInt(p.people, 10) || 1)), supervisor: String(p.supervisor || "").trim(),
      notes: String(p.notes || "").trim().slice(0, 1000), justification: String(p.justification || "").trim().slice(0, 1000),
      status: "Confirmed", slots, bookedAt: f.now(),
    };
    if (data.name.length < 2 || data.name.length > 120) throw new Error("Enter your full name.");
    if (data.studentId.length < 3 || data.studentId.length > 30) throw new Error("Enter your matric number.");
    if (data.phone.length > 30) throw new Error("That phone number is too long.");
    if (data.supervisor.length > 120) throw new Error("That supervisor name is too long.");
    const busy = roomName(p.room) + " was just booked by someone else for part of that time. Pick another room or time.";
    const closed = roomName(p.room) + " is closed for part of that time. Pick another room or time.";
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = makeCode();
      try {
        await runTransaction(f.db, async t => {
          const cl = await t.get(ref(f, "closures", p.date));
          const items = cl.exists() ? cl.data().items || {} : {};
          const hrs = []; for (let h = data.hour; h < data.hour + data.hours; h++) hrs.push(pad(h));
          if (items.all_all || items["all_" + data.room] || hrs.some(h => items[h + "_" + data.room] || items[h + "_all"])) throw new Error(closed);
          const snaps = await Promise.all(slots.map(k => t.get(ref(f, "slots", k))));
          if (snaps.some(s => s.exists())) throw new Error(busy);
          t.set(ref(f, "bookings", code), { ...data, code });
          slots.forEach(k => t.set(ref(f, "slots", k), { code, date: p.date }));
        });
        // Remember their details for next time, if they haven't saved a profile yet.
        getDoc(ref(f, "profiles", f.u.uid)).then(d => {
          if (!d.exists() && data.name.length >= 2 && data.studentId.length >= 3) setDoc(ref(f, "profiles", f.u.uid), { email: f.email, name: data.name, studentId: data.studentId, phone: data.phone, programme: "", supervisor: data.supervisor, updatedAt: f.now() });
        }).catch(() => {});
        return { code, emailed: false, start: data.hour, end: data.hour + data.hours, room: roomName(p.room) };
      } catch (e) {
        if (e.code === "permission-denied" && attempt < 1) {
          // Either someone took the room a moment ago, or the code was already used. Check which.
          const again = await Promise.all(slots.map(k => getDoc(ref(f, "slots", k))));
          if (again.some(s => s.exists())) throw new Error(busy);
          continue;
        }
        throw new Error(e.code ? friendly(e) : e.message);
      }
    }
    throw new Error("The booking didn't go through. Try again.");
  },

  async lookup() {
    const f = await user();
    const list = (await myBookings(f, f.u)).filter(b => b.status === "Confirmed" && !isPast(b.date, b.hour));
    list.sort((x, y) => (x.date + pad(x.hour) > y.date + pad(y.hour) ? 1 : -1));
    return { bookings: list.map(b => ({ date: b.date, hour: b.hour, end: b.end, room: b.room, purpose: b.purpose, code: b.code })) };
  },

  async cancel(p) {
    const f = await user();
    const r = ref(f, "bookings", String(p.code || ""));
    try {
      await runTransaction(f.db, async t => {
        const d = await t.get(r).catch(() => null);
        if (!d || !d.exists() || d.data().uid !== f.u.uid) throw new Error("We couldn't find that booking on your account.");
        const b = d.data();
        if (b.status !== "Confirmed") throw new Error("This booking is already cancelled.");
        if (isPast(b.date, b.hour)) throw new Error("This session has already started, so it can't be cancelled online.");
        const slots = await Promise.all(b.slots.map(k => t.get(ref(f, "slots", k))));
        t.update(r, { status: "Cancelled", cancelledAt: f.now() });
        slots.forEach(s => { if (s.exists() && s.data().code === d.id) t.delete(s.ref); });
      });
    } catch (e) { throw new Error(e.code ? friendly(e) : e.message); }
    return { ok: true };
  },

  async hours() {
    const f = await user();
    const sessions = (await myBookings(f, f.u))
      .filter(b => (b.status === "Confirmed" || b.status === "Attended") && isPast(b.date, b.end))
      .map(b => ({ date: b.date, hour: b.hour, end: b.end, hours: b.hours, room: b.room, purpose: b.purpose, status: b.status, code: b.code, people: b.people }));
    const totals = {};
    SETTINGS.purposes.forEach(x => (totals[x.name] = { hours: 0, sessions: 0 }));
    sessions.forEach(s => { totals[s.purpose] = totals[s.purpose] || { hours: 0, sessions: 0 }; totals[s.purpose].hours += s.hours; totals[s.purpose].sessions++; });
    sessions.sort((x, y) => (x.date + pad(x.hour) < y.date + pad(y.hour) ? 1 : -1));
    return { email: f.email, sessions, totals, total: sessions.reduce((t, x) => t + x.hours, 0), sample: false };
  },

  async ticket(p) {
    if (p.website) return { id: "T-OK" };
    const f = await boot();
    const u = f.auth.currentUser;
    const d = new Date(), id = "T-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + makeCode().slice(0, 4);
    const clip = (v, n) => String(v || "").trim().slice(0, n);
    try {
      await addDoc(col(f, "tickets"), {
        id, type: clip(p.type, 60) || "Other", page: clip(p.page, 60), subject: clip(p.subject, 150), message: clip(p.message, 4000),
        steps: clip(p.steps, 2000), name: clip(p.name, 120), email: clip(p.email, 200).toLowerCase(),
        signedIn: u && u.email ? u.email.toLowerCase() : "", ua: clip(p.ua, 300), status: "Open", at: f.now(),
      });
    } catch (e) { throw new Error(friendly(e)); }
    return { id };
  },

  async survey(p) {
    const f = await boot();
    const a = {}; Object.entries(p.answers || {}).forEach(([k, v]) => (a[k] = typeof v === "number" ? v : String(v).slice(0, 1500)));
    try { await addDoc(col(f, "survey"), { answers: a, at: f.now() }); } catch (e) { throw new Error(friendly(e)); }
    return { ok: true };
  },

  // ---------------------------------------------------------------- admin
  async adminData() {
    const f = await user();
    if (!(await isAdminEmail(f, f.email))) throw new Error(f.email + " isn't a lab admin. Ask the site owner to add you in Firebase (Firestore › admins).");
    const since = new Date(); since.setDate(since.getDate() - 400);
    const recent = new Date(); recent.setDate(recent.getDate() - 30);
    const [bq, cq, pq] = await Promise.all([
      getDocs(query(col(f, "bookings"), where("date", ">=", ymd(since)))),
      getDocs(query(col(f, "closures"), where("date", ">=", ymd(recent)))),
      getDocs(col(f, "profiles")),
    ]);
    const bookings = bq.docs.map(shape).map(({ slots, uid, bookedAtMs, ...b }) => b);
    const closures = [];
    cq.forEach(d => Object.entries(d.data().items || {}).forEach(([k, v]) => {
      const [h, r] = k.split("_");
      closures.push({ date: d.id, hour: h === "all" ? null : +h, room: r === "all" ? null : r, reason: v.reason || "", at: stamp(v.at), row: d.id + "|" + k });
    }));
    closures.sort((x, y) => (x.date + (x.hour == null ? "00" : pad(x.hour)) > y.date + (y.hour == null ? "00" : pad(y.hour)) ? 1 : -1));
    const profiles = {}; pq.forEach(d => { const p = d.data(); profiles[p.email] = { name: p.name, studentId: p.studentId, phone: p.phone, programme: p.programme, supervisor: p.supervisor }; });
    return { bookings, closures, profiles, sample: false };
  },

  async adminSetStatus(p) {
    const f = await user();
    const r = ref(f, "bookings", String(p.code || ""));
    try {
      await runTransaction(f.db, async t => {
        const d = await t.get(r);
        if (!d.exists()) throw new Error("Booking not found.");
        const b = d.data();
        const slotRefs = b.slots.map(k => ref(f, "slots", k));
        const slots = await Promise.all(slotRefs.map(x => t.get(x)));
        const update = { status: p.status, statusBy: f.email, statusAt: f.now() };
        if (p.status === "Cancelled") {
          update.cancelledAt = f.now();
          slots.forEach(s => { if (s.exists() && s.data().code === d.id) t.delete(s.ref); });
        } else if (b.status === "Cancelled") {
          // Restoring a cancelled booking: only if its room-hours are still free.
          if (slots.some(s => s.exists())) throw new Error("That time has been booked by someone else since, so it can't be restored.");
          slotRefs.forEach(x => t.set(x, { code: d.id, date: b.date }));
        }
        t.update(r, update);
      });
    } catch (e) { throw new Error(e.code ? friendly(e) : e.message); }
    return { ok: true };
  },

  async adminBlock(p) {
    const f = await user();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) throw new Error("Pick a date.");
    const key = (p.hour === "" || p.hour == null ? "all" : pad(+p.hour)) + "_" + (p.room ? String(p.room) : "all");
    const r = ref(f, "closures", p.date);
    try {
      await runTransaction(f.db, async t => {
        const d = await t.get(r);
        const items = d.exists() ? { ...(d.data().items || {}) } : {};
        if (items[key]) throw new Error("That's already closed.");
        // Closures are public (they show as Closed on the timetable), so no names or emails go in here.
        items[key] = { reason: String(p.reason || "").trim().slice(0, 300), at: Timestamp.now() };
        t.set(r, { date: p.date, items });
      });
    } catch (e) { throw new Error(e.code ? friendly(e) : e.message); }
    return { ok: true };
  },

  async adminUnblock(p) {
    const f = await user();
    const [date, key] = String(p.row || "").split("|");
    const r = ref(f, "closures", date);
    try {
      await runTransaction(f.db, async t => {
        const d = await t.get(r);
        if (!d.exists()) return;
        const items = { ...(d.data().items || {}) }; delete items[key];
        if (Object.keys(items).length) t.set(r, { date, items }); else t.delete(r);
      });
    } catch (e) { throw new Error(friendly(e)); }
    return { ok: true };
  },

  async adminTickets() {
    const f = await user();
    const q = await getDocs(col(f, "tickets"));
    const tickets = q.docs.map(d => ({ ...d.data(), row: d.id, atMs: tsMs(d.data().at), at: stamp(d.data().at) }))
      .sort((x, y) => y.atMs - x.atMs);
    return { tickets, sample: false };
  },
  async adminSetTicket(p) {
    const f = await user();
    try { await updateDoc(ref(f, "tickets", String(p.row)), { status: p.status }); } catch (e) { throw new Error(friendly(e)); }
    return { ok: true };
  },
  async adminSurvey() {
    const f = await user();
    const q = await getDocs(col(f, "survey"));
    const responses = q.docs.map(d => ({ at: tsMs(d.data().at), "Submitted at": stamp(d.data().at).slice(0, 10), ...(d.data().answers || {}) }))
      .sort((x, y) => y.at - x.at).map(({ at, ...r }) => r);
    return { responses, sample: false };
  },
};

// ================================================================ sign-in kept on this device
// Falls back to memory if storage is blocked. Changes are broadcast so the header and pages update.
let mem = null;
export const Auth = {
  get() { if (typeof window === "undefined") return null; try { return JSON.parse(localStorage.getItem("lab-auth") || "null"); } catch (e) { return mem; } },
  set(v) { mem = v; try { localStorage.setItem("lab-auth", JSON.stringify(v)); } catch (e) {} ping(); },
  clear() { mem = null; try { localStorage.removeItem("lab-auth"); } catch (e) {} ping(); },
};
function ping() { if (typeof window !== "undefined") window.dispatchEvent(new Event("lab-auth")); }

export { ymd, pad, isPast };
export const API = DEMO ? demo : live;

// Live: start Firebase as soon as a page loads in the browser.
if (!DEMO && typeof window !== "undefined") boot().catch(() => {});
