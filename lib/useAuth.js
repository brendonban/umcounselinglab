"use client";
import { useEffect, useState } from "react";
import { Auth } from "./api";

// The signed-in person on this device ({ token, email, profile } or null).
// `ready` turns true after the first read in the browser, so pages don't flash the wrong state.
export function useAuth() {
  const [auth, setAuth] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setAuth(Auth.get());
    sync(); setReady(true);
    window.addEventListener("lab-auth", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("lab-auth", sync); window.removeEventListener("storage", sync); };
  }, []);
  return [auth, ready];
}
