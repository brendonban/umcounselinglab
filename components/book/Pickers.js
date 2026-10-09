"use client";
import { DOW, niceDate, span } from "@/lib/ui";

// Step 2: the row of day buttons with how many start times are still free.
export function DayPicker({ days, sel, freeStarts, onPick }) {
  return (
    <div id="days" className="days" role="group" aria-label="Days">
      {days.map(date => {
        const free = freeStarts(date);
        const [y, m, d] = date.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        return (
          <button key={date} type="button" className="day" aria-pressed={date === sel}
            aria-label={niceDate(date) + ", " + (free ? free + " start times free" : "full")}
            onClick={() => onPick(date)}>
            <span className="dow">{DOW[dt.getDay()]}</span><span className="dnum">{d}</span><span className="dfree">{free ? free + " free" : "full"}</span>
          </button>
        );
      })}
    </div>
  );
}

// Step 3: start times, coloured by how many rooms are left.
export function SlotPicker({ hours, sel, n, start, rooms, sched, onPick }) {
  const total = rooms.length;
  return (
    <div id="slots" className="slots">
      {hours.map(h => {
        const free = sched.freeRooms(sel, h, n).length;
        const allBlocked = rooms.every(r => sched.isBlocked(sel, h, r.id));
        let cls = "slot", st;
        if (allBlocked) { cls += " blocked"; st = "Closed"; }
        else if (!free) { cls += " taken"; st = rooms.some(r => sched.blockFree(sel, h, r.id)) ? "Not enough time for " + n + " h" : "Fully booked"; }
        else if (free <= 2 && free < total) { cls += " low"; st = free === 1 ? "1 room left" : "2 rooms left"; }
        else st = free + " of " + total + " rooms free";
        return (
          <button key={h} type="button" className={cls} disabled={!free} aria-pressed={start === h} onClick={() => onPick(h)}>
            <span className="t">{span(h, h + n)}</span><span className="s">{st}</span>
          </button>
        );
      })}
    </div>
  );
}

// Step 3: the rooms of the purpose's type, with only those free for the whole span enabled.
export function RoomPicker({ pickRef, sel, start, n, rooms, ok, room, onPick }) {
  return (
    <div id="roomPick" className="panel" ref={pickRef} hidden={start === null}>
      <div className="picked" id="roomHead">{start === null ? "Pick a room" : "Pick a room for " + niceDate(sel) + ", " + span(start, start + n)}</div>
      <div id="rooms" className="rooms" role="group" aria-label="Rooms">
        {start !== null && rooms.map(r => {
          const free = ok.includes(r.id);
          return (
            <button key={r.id} type="button" className="room" disabled={!free} aria-pressed={room === r.id} onClick={() => onPick(r.id)}>
              <span className="rn">{r.name}</span><span className="rs">{free ? "Free" : "Taken"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
