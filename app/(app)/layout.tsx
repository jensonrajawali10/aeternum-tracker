import { Suspense } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { SWRProvider } from "@/components/SWRProvider";
import { DensityProvider } from "@/components/DensityProvider";
import { CommandPalette } from "@/components/CommandPalette";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SWRProvider>
      <DensityProvider>
        <div className="flex min-h-screen bg-bg text-fg">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <MobileTopBar />
            <main className="flex-1 min-w-0 px-4 py-4 md:px-8 md:py-6 overflow-x-hidden fade-in">
              {children}
            </main>
          </div>
        </div>
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      </DensityProvider>
    </SWRProvider>
  );
}
