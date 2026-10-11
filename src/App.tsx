import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PeriodProvider } from "@/state/period";
import { AppShell } from "@/components/fa/AppShell";
import Overview from "@/pages/fa/Overview";
import Activity from "@/pages/fa/Activity";
import Placeholder from "@/pages/fa/Placeholder";
import Categories from "@/pages/fa/Categories";
import Stats from "@/pages/fa/Stats";
import NotFound from "@/pages/NotFound";

// The QueryClient lives in main.tsx (QueryProvider). Old Lovable pages stay on disk until P5 but are no longer routed.
export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <PeriodProvider>
          <Toaster position="top-center" />
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Overview />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/budgets" element={<Placeholder title="Budgets" />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/settings" element={<Placeholder title="Settings" />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PeriodProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
