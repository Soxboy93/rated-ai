import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EnhancedChat from "./pages/EnhancedChat";
import SimpleParentDashboard from "./pages/SimpleParentDashboard";
import StoryStudio from "./pages/StoryStudio";
import Achievements from "./pages/Achievements";
import HomeworkHelper from "./pages/HomeworkHelper";
import VirtualPet from "./pages/VirtualPet";
import ReportCard from "./pages/ReportCard";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={EnhancedChat} />
      <Route path={"/parent"} component={SimpleParentDashboard} />
      <Route path={"/story-studio"} component={StoryStudio} />
      <Route path={"/achievements"} component={Achievements} />
      <Route path={"/homework"} component={HomeworkHelper} />
      <Route path={"/pet"} component={VirtualPet} />
      <Route path={"/report-card"} component={ReportCard} />
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
