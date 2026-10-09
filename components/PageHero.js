import Link from "next/link";

// The grey-ruled page title used at the top of inner pages.
export default function PageHero({ crumb, title, children, label }) {
  return (
    <div className="page-hero">
      <div className="wrap">
        <span className="crumb"><Link href="/">Home</Link> / {crumb}</span>
        <div className="rule"></div>
        <h1>{title}</h1>
        <p>{children}</p>
        {label}
      </div>
    </div>
  );
}
