import Link from "next/link";
export default function NotFound() {
  return <main id="main-content" className="not-found page-container"><h1>Let’s find your way back.</h1><p>This page or country could not be found.</p><Link href="/mvps" className="explore-link">Browse the global directory →</Link></main>;
}
