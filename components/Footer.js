import Link from "next/link";
import { SITE } from "@/lib/settings";

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot">
          <div className="foot-about">
            <b>{SITE.LAB_NAME}</b>
            <span>{SITE.ADDRESS}</span>
            <span>{SITE.HOURS}</span>
          </div>
          <nav className="foot-cols" aria-label="Footer">
            <div><span className="foot-h">Booking</span><Link href="/book">Book a room</Link><Link href="/rules">Rules</Link><Link href="/rules#cancel">Cancellation</Link></div>
            <div><span className="foot-h">Help</span><Link href="/guide">Guide</Link><Link href="/support">Support</Link><Link href="/survey">Give feedback</Link></div>
          </nav>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} {SITE.LAB_NAME}</span>
          <span>Designed &amp; built by {SITE.DEVELOPER_NAME} · <Link className="staff" href="/admin">Staff login</Link></span>
        </div>
      </div>
    </footer>
  );
}
