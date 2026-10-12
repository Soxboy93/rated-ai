import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthPage from "./pages/AuthPage";
import ConsentPage from "./pages/ConsentPage";
import { trpc } from "@/lib/trpc";
import { useAuth } from "./_core/hooks/useAuth";
import { AccessibilityProvider } from "./kid/Accessibility";
import { ChildProvider, useChild } from "./kid/ChildContext";
import PlayerPicker from "./kid/PlayerPicker";
import Home from "./kid/Home";
import Chat from "./kid/Chat";
import Story from "./kid/Story";
import Doodle from "./kid/Doodle";
import Mood from "./kid/Mood";
import Trophies from "./kid/Trophies";
import Pet from "./kid/Pet";
import Homework from "./kid/Homework";
import { MathGame, SpellingGame, QuizGame, PatternGame, MemoryGame } from "./kid/games";
import ParentArea from "./parent/ParentArea";

/** Kid routes need to know who is playing; until a profile is chosen, show the picker. */
function KidRoutes() {
  const { child, profilesLoading } = useChild();
  if (profilesLoading) return <div className="kid grid min-h-screen place-items-center"><p className="k-muted">Loading…</p></div>;
  if (!child) return <PlayerPicker />;
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/games/math" component={MathGame} />
      <Route path="/games/spelling" component={SpellingGame} />
      <Route path="/games/quiz" component={QuizGame} />
      <Route path="/games/memory" component={MemoryGame} />
      <Route path="/games/patterns" component={PatternGame} />
      <Route path="/chat" component={Chat} />
      <Route path="/story" component={Story} />
      <Route path="/doodle" component={Doodle} />
      <Route path="/mood" component={Mood} />
      <Route path="/trophies" component={Trophies} />
      <Route path="/pet" component={Pet} />
      <Route path="/homework" component={Homework} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const consent = trpc.consent.status.useQuery(undefined, { enabled: !!user });
  if (loading || (user && consent.isLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }
  // Every feature stores a child's data, so the whole app requires a parent account.
  if (!user) return <AuthPage />;
  // Nothing that handles a child's data is reachable until a parent has agreed. The parent area stays
  // reachable so a parent can still export or delete data after withdrawing consent.
  if (!consent.data?.granted && location !== "/parent") return <ConsentPage contactEmail={consent.data?.contactEmail ?? null} />;
  return (
    <AccessibilityProvider>
      <ChildProvider>
        {location === "/parent" ? <ParentArea /> : <KidRoutes />}
      </ChildProvider>
    </AccessibilityProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
