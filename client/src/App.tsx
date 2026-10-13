import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";
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
import Lesson from "./kid/Lesson";
import { MathGame, SpellingGame, QuizGame, PatternGame, MemoryGame } from "./kid/games";
import ParentArea from "./parent/ParentArea";
import { LangProvider, t, useLang } from "./i18n";

/** Kid routes need to know who is playing; until a profile is chosen, show the picker. */
function KidRoutes() {
  const { child, profilesLoading } = useChild();
  if (profilesLoading) return <div className="kid grid min-h-screen place-items-center"><p className="k-muted">{t("Loading…")}</p></div>;
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
      <Route path="/lesson/:shareId" component={Lesson} />
      <Route component={NotFound} />
    </Switch>
  );
}

let languageAppliedFor: string | null = null;

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const consent = trpc.consent.status.useQuery(undefined, { enabled: !!user });
  const { lang, setLang } = useLang();
  // A signed-in account's saved language wins over the browser default, but only once per sign-in: changing the
  // language remounts this component and must not be undone by a stale cached value.
  useEffect(() => {
    if (!user) { languageAppliedFor = null; return; }
    if (languageAppliedFor === user.id) return;
    languageAppliedFor = user.id;
    if (user.language && user.language !== lang) setLang(user.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  if (loading || (user && consent.isLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">{t("Loading…")}</div>;
  }
  // Every feature stores a child's data, so the whole app requires a parent account.
  if (!user) return <AuthPage />;
  // Nothing that handles a child's data is reachable until a parent has agreed. The parent area stays
  // reachable so a parent can still export or delete data after withdrawing consent.
  if (!consent.data?.granted && location !== "/parent") return <ConsentPage contactEmail={consent.data?.contactEmail ?? null} accountType={consent.data?.accountType ?? "family"} version={consent.data?.version ?? ""} />;
  return (
    <AccessibilityProvider>
      <ChildProvider>
        {location === "/parent" ? <ParentArea /> : <KidRoutes />}
      </ChildProvider>
    </AccessibilityProvider>
  );
}

// Preview build: no real URLs inside the embedded page, so navigate in memory and label it clearly.
const DEMO = !!import.meta.env.VITE_DEMO;
const demoHook = DEMO ? memoryLocation({ path: "/" }).hook : undefined;

function App() {
  return (
    <LangProvider>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {demoHook ? <WouterRouter hook={demoHook}><Router /></WouterRouter> : <Router />}
          {DEMO && (
            <div role="note" style={{ position: "fixed", left: 10, bottom: "calc(10px + env(safe-area-inset-bottom, 0px))", zIndex: 30, pointerEvents: "none", background: "#fff4d6", color: "#6e4300", border: "2px solid #f0cf86", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              {t("Preview · example data · nothing is saved")}
            </div>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </LangProvider>
  );
}

export default App;
