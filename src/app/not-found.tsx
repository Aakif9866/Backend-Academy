import Link from "next/link";
import { Page } from "@/components/ui";

export default function NotFound() {
  return (
    <Page>
      <div className="glow border border-line bg-surface corner p-10 lg:p-16 text-center">
        <p className="text-6xl font-bold text-grad">404</p>
        <h1 className="mt-4 text-2xl font-bold text-heading">This page isn&apos;t on the roadmap</h1>
        <p className="mt-2 text-muted">Try search (⌘K) or head back to the dashboard.</p>
        <Link href="/" className="mt-8 inline-block px-6 py-3 corner-sm bg-grad text-white font-medium">Dashboard</Link>
      </div>
    </Page>
  );
}
