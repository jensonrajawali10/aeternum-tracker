import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { SWRProvider } from "@/components/SWRProvider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SWRProvider>
      <div className="flex min-h-screen bg-bg text-fg">
        <Sidebar />
        <main className="flex-1 min-w-0 px-8 py-6 overflow-x-hidden fade-in">{children}</main>
      </div>
    </SWRProvider>
  );
}
