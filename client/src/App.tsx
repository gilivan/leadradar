import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import AdminSettings from "./pages/AdminSettings";
import AdminProfiles from "./pages/AdminProfiles";
import AdminSchedule from "./pages/AdminSchedule";
import AdminEmail from "./pages/AdminEmail";
import ExecutionLogs from "./pages/ExecutionLogs";
import FeedbackRules from "./pages/FeedbackRules";
import NotFound from "./pages/NotFound";
import LocalLogin from "./pages/LocalLogin";

// Detect local auth mode from meta tag injected by server
const isLocalAuth = document.querySelector('meta[name="local-auth"]')?.getAttribute('content') === 'true';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/opportunities/:id" component={OpportunityDetail} />
      <Route path="/logs" component={ExecutionLogs} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/profiles" component={AdminProfiles} />
      <Route path="/admin/schedule" component={AdminSchedule} />
      <Route path="/admin/email" component={AdminEmail} />
      <Route path="/admin/feedback-rules" component={FeedbackRules} />
      <Route path="/login" component={LocalLogin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
