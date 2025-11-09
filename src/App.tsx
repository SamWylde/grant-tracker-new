import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
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
                <Route path="/" element={<HomePage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/saved" element={<SavedGrantsPage />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="/metrics" element={<MetricsPage />} />

                {/* Settings Routes */}
                <Route path="/settings/profile" element={<ProfilePage />} />
                <Route path="/settings/org" element={<OrganizationPage />} />
                <Route path="/settings/team" element={<TeamPage />} />
                <Route path="/settings/notifications" element={<NotificationsPage />} />
                <Route path="/settings/calendar" element={<CalendarPage />} />
                <Route path="/settings/billing" element={<BillingPage />} />
                <Route path="/settings/danger" element={<DangerZonePage />} />
              </Routes>
            </BrowserRouter>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
