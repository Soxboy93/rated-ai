import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EnhancedChat from "./pages/EnhancedChat";
import SimpleParentDashboard from "./pages/SimpleParentDashboard";
import StoryStudio from "./pages/StoryStudio";
import Achievements from "./pages/Achievements";
import HomeworkHelper from "./pages/HomeworkHelper";
import VirtualPet from "./pages/VirtualPet";
import ReportCard from "./pages/ReportCard";
import WeeklySummary from "./pages/WeeklySummary";
import TeacherDashboard from "./pages/TeacherDashboard";
import AccessibilitySettings from "./pages/AccessibilitySettings";
import CollegePrep from "./pages/CollegePrep";
import PeerChallenges from "./pages/PeerChallenges";
import AuthPage from "./pages/AuthPage";
import ConsentPage from "./pages/ConsentPage";
import { trpc } from "@/lib/trpc";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const consent = trpc.consent.status.useQuery(undefined, { enabled: !!user });
  if (loading || (user && consent.isLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }
  // Every feature stores a child's data, so the whole app requires a parent account.
  if (!user) return <AuthPage />;
  // Nothing that handles a child's data is reachable until a parent has agreed.
  // The parent area stays reachable without consent so a parent can still export or delete data.
  if (!consent.data?.granted && location !== "/parent") return <ConsentPage contactEmail={consent.data?.contactEmail ?? null} />;
  return (
    <Switch>
      <Route path={"/"} component={EnhancedChat} />
      <Route path={"/parent"} component={SimpleParentDashboard} />
      <Route path={"/story-studio"} component={StoryStudio} />
      <Route path={"/achievements"} component={Achievements} />
      <Route path={"/homework"} component={HomeworkHelper} />
      <Route path={"/pet"} component={VirtualPet} />
      <Route path={"/report-card"} component={ReportCard} />
      <Route path={"/weekly-summary"} component={WeeklySummary} />
      <Route path={"/teacher"} component={TeacherDashboard} />
      <Route path={"/accessibility"} component={AccessibilitySettings} />
      <Route path={"/college-prep"} component={CollegePrep} />
      <Route path={"/challenges"} component={PeerChallenges} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
