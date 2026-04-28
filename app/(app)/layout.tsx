import { Suspense } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { TopBar } from "@/components/shell/TopBar";
import { Footer } from "@/components/shell/Footer";
import { TickerTape } from "@/components/TickerTape";
import { SWRProvider } from "@/components/SWRProvider";
import { DensityProvider } from "@/components/DensityProvider";
import { CommandPalette } from "@/components/CommandPalette";

export const dynamic = "force-dynamic";

/**
 * Authenticated app shell — Bloomberg-terminal-inspired layout (Phase 2):
 *
 *   [ TopBar (md+, 36px)               ]    desktop chrome
 *   [ MobileTopBar (<md)               ]    mobile chrome
 *   [ Sidebar | main                   ]    sidebar+content row
 *   [ Footer (md+, 22px)               ]    status footer
 *
 * Cmd+K palette stays mounted globally; cmdk wiring lands in Phase 3.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SWRProvider>
      <DensityProvider>
        <div className="min-h-screen flex flex-col bg-bg text-fg">
          <TopBar />
          <TickerTape />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              <MobileTopBar />
              <main className="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-5 overflow-x-hidden fade-in">
                {children}
              </main>
            </div>
          </div>
          <Footer />
        </div>
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      </DensityProvider>
    </SWRProvider>
  );
}
