"use client";
import { DEMO } from "@/lib/api";

// Shown while no Firebase settings are set, so nobody mistakes the demo for the real thing.
export default function DemoNotice({ style }) {
  if (!DEMO) return null;
  return (
    <div className="notice" style={style}>
      <strong>Demo mode.</strong> Bookings and answers are saved only in this browser. Add your Firebase settings (see README) to go live.
    </div>
  );
}
