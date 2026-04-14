import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">Not found</p>
      <h1 className="detail-title">Opportunity not found</h1>
      <p>The requested signal is not in the current launch market dataset.</p>
      <Link className="button" href="/">
        Back to home feed
      </Link>
    </div>
  );
}
