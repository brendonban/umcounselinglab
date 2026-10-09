import Link from "next/link";


export const metadata = { title: "Rules" };

export default function RulesPage() {
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="crumb"><Link href="/">Home</Link> / Rules</span>
          <div className="rule"></div>
          <h1>Rules and how booking works</h1>
          <p>Everything to know before you book a room at the Counseling Lab.</p>
          <div className="chips"><a className="chip" href="#how">How it works</a><a className="chip" href="#rules">Rules</a><a className="chip" href="#cancel">Cancellation &amp; FAQ</a></div>
        </div>
      </div>
      <main id="main">
      <section id="how">
        <div className="wrap">
          <div className="sec-head">
            <div><span className="label">How it works</span><h2>3 simple steps</h2></div>
            <p>Free hours are shown in full; taken ones are faded and crossed through, so bookings never overlap.</p>
          </div>
          <div className="steps">
            <div className="step"><span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg></span><span className="label">Step 1</span><h3>Pick a session, day and time</h3><p>Individual sessions are up to 1 hour, group sessions up to 2. Longer bookings need a short reason.</p></div>
            <div className="step"><span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg></span><span className="label">Step 2</span><h3>Choose a free room</h3><p>Only the rooms for your session type are shown, with what's free at your time.</p></div>
            <div className="step"><span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span><span className="label">Step 3</span><h3>Sign in and confirm</h3><p>Continue with your UM Google account. You get a booking code straight away, and it stays under My profile.</p></div>
          </div>
        </div>
      </section>

      <section id="rules">
        <div className="wrap">
          <div className="sec-head">
            <div><span className="label">Rules and regulations</span><h2>Before you book</h2></div>
            <p>The booking page checks these for you, but please read them once.</p>
          </div>
          <ul className="rlist">
            <li className="ritem"><span className="n">01</span><div><h3>Counseling students only</h3><p>The rooms are for counseling students, for academic or practicum-related purposes.</p></div></li>
            <li className="ritem"><span className="n">02</span><div><h3>Book one day ahead</h3><p>Bookings must be made at least one day in advance.</p></div></li>
            <li className="ritem"><span className="n">03</span><div><h3>State who and why</h3><p>Give your name, matric number and purpose of use clearly.</p></div></li>
            <li className="ritem"><span className="n">04</span><div><h3>Hourly blocks</h3><p>Rooms are booked by the hour.</p><ul><li>Individual counselling: up to 1 hour, Rooms 2–8</li><li>Group counselling: up to 2 hours, Room 1 or 10</li><li>Longer than this must be justified</li></ul></div></li>
            <li className="ritem"><span className="n">05</span><div><h3>No overlapping bookings</h3><p>Check the schedule before reserving. Taken times can't be selected.</p></div></li>
            <li className="ritem"><span className="n">06</span><div><h3>Don't remove others' bookings</h3><p>Do not erase bookings that are occupied. Offenders will be penalised.</p></div></li>
          </ul>

          <span className="label subhead">Usage etiquette</span>
          <ul className="rlist">
            <li className="ritem"><span className="n">01</span><div><h3>Leave it as you found it</h3><p>Keep the room clean and return it to its original state.</p></div></li>
            <li className="ritem"><span className="n">02</span><div><h3>No food or drinks</h3><p>Not during sessions. Candy and mineral water are fine.</p></div></li>
            <li className="ritem"><span className="n">03</span><div><h3>Leave on time</h3><p>Vacate promptly when your slot ends. Repeat offences will be penalised.</p></div></li>
            <li className="ritem"><span className="n">04</span><div><h3>Supervision and equipment</h3><p>Practicum sessions may need your supervisor's approval or presence. Recording tools and special equipment need prior approval.</p></div></li>
          </ul>
        </div>
      </section>

      <section id="cancel">
        <div className="wrap">
          <div className="sec-head">
            <div><span className="label">Cancellation policy</span><h2>Can't make it? Cancel online.</h2></div>
            <p>Sign in on the booking page and tap Cancel next to the booking under "My bookings". You can cancel any time before the session starts, and the room opens up for others straight away.</p>
          </div>
          <div className="faq">
            <details><summary>Why do I need to sign in?</summary><p>Only UM students and staff can book. Tap <b>Continue with Google</b> and pick your @siswa.um.edu.my or @um.edu.my account. There's no password to make up, and you stay signed in on that device until you sign out.</p></details>
            <details><summary>Can I book for today?</summary><p>No. Bookings must be made at least one day in advance, so the earliest day you can pick is tomorrow.</p></details>
            <details><summary>Can I book longer than the limit?</summary><p>Yes, if you explain why. The booking form asks for a justification when you pick more hours than your session type allows.</p></details>
            <details><summary>Where can I see my bookings?</summary><p>On the booking page, under "My bookings", once you're signed in.</p></details>
            <details><summary>Will I get a confirmation email?</summary><p>No. Your booking code shows as soon as you book, and all your bookings are listed under <Link className="link" href="/profile">My profile</Link>. Add the session to your own calendar if you like a reminder.</p></details>
          </div>
        </div>
      </section>


      </main>
    </>
  );
}
