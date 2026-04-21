import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Benchmark chart is now folded into the Dashboard.
// Preserve the /benchmark URL by redirecting, carrying book filter through.
export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const params = await searchParams;
  const qs = params.book ? `?book=${encodeURIComponent(params.book)}` : "";
  redirect(`/dashboard${qs}`);
}
