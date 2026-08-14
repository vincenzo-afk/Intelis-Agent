import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AskMode from "./pages/AskMode";
import Collections from "./pages/Collections";
import IntelisDashboard from "./pages/IntelisDashboard";
import Reports from "./pages/Reports";
import ResearchTasks from "./pages/ResearchTasks";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}><DashboardLayout><IntelisDashboard /></DashboardLayout></Route>
      <Route path={"/research"}><DashboardLayout><ResearchTasks /></DashboardLayout></Route>
      <Route path={"/collections"}><DashboardLayout><Collections /></DashboardLayout></Route>
      <Route path={"/ask"}><DashboardLayout><AskMode /></DashboardLayout></Route>
      <Route path={"/reports"}><DashboardLayout><Reports /></DashboardLayout></Route>
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
