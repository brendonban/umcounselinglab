import Link from "next/link";
import DemoNotice from "@/components/DemoNotice";
import Icon from "@/components/Icon";
import Availability from "@/components/Availability";
import { SITE } from "@/lib/settings";

// Home: hero, quick facts, live room availability and the "get started" band.
export default function HomePage() {
  return (
    <main id="main">
      <div className="hero">
        <div className="wrap">
          <div className="rule"></div>
          <h1>Book a counseling room in a minute.</h1>
          <p>The Counseling Lab at Menara Pendidikan has private rooms for counseling students&apos; practicum sessions, group work and skills practice. Check what&apos;s free, sign in with your UM Google account, and reserve your room at least a day ahead.</p>
          <div className="row">
            <Link className="cta-btn" href="/book">Book a room</Link>
            <a className="link" href="#availability">See what&apos;s free now</a>
          </div>
        </div>
      </div>

      <div className="wrap">
        <DemoNotice style={{ marginTop: "1.6rem" }} />
        <ul className="facts">
          <li><Icon name="user" /><b>Rooms 2–8</b><span>Individual counselling sessions</span></li>
          <li><Icon name="users" /><b>Rooms 1 &amp; 10</b><span>Group counselling sessions</span></li>
          <li><Icon name="calendar" /><b>One day ahead</b><span>Book from tomorrow, up to 2 weeks out</span></li>
          <li><Icon name="lock" /><b>UM sign-in</b><span>@siswa.um.edu.my or @um.edu.my</span></li>
        </ul>
      </div>

      <Availability />

      <section className="band">
        <div className="wrap">
          <div>
            <span className="label">Get started</span>
            <h2>Reserve a counseling room</h2>
            <ul className="meta">
              <li><Icon name="clock" box="mi" /><span>Monday to Sunday, 9.00 am – 9.00 pm</span></li>
              <li><Icon name="pin" box="mi" /><span>{SITE.LOCATION || "Counseling Lab, Level 03, Menara Pendidikan, UM"}</span></li>
            </ul>
          </div>
          <div className="actions">
            <Link className="cta-btn" href="/book">Book a room</Link>
            <Link className="link" href="/rules">Read the rules first</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
