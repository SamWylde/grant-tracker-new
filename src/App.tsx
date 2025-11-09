import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomePage } from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import { PricingPage } from "./pages/PricingPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { SavedGrantsPage } from "./pages/SavedGrantsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { MetricsPage } from "./pages/MetricsPage";
import {
  ProfilePage,
  OrganizationPage,
  TeamPage,
  NotificationsPage,
  CalendarPage,
  BillingPage,
  DangerZonePage,
} from "./pages/settings";
import { theme } from "./theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrganizationProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/features" element={<FeaturesPage />} />

                {/* Protected Routes */}
                <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
                <Route path="/saved" element={<ProtectedRoute><SavedGrantsPage /></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
                <Route path="/metrics" element={<ProtectedRoute><MetricsPage /></ProtectedRoute>} />

                {/* Protected Settings Routes */}
                <Route path="/settings/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/settings/org" element={<ProtectedRoute><OrganizationPage /></ProtectedRoute>} />
                <Route path="/settings/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/settings/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/settings/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                <Route path="/settings/danger" element={<ProtectedRoute><DangerZonePage /></ProtectedRoute>} />
              </Routes>
            </BrowserRouter>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
