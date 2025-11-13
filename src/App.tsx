import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
import { HomePage } from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";
import { PricingPage } from "./pages/PricingPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SupportPage } from "./pages/SupportPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { PipelinePage } from "./pages/PipelinePage";
import { GrantDetailPage } from "./pages/GrantDetailPage";
import { MetricsPage } from "./pages/MetricsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { GrantHubImportPage } from "./pages/GrantHubImportPage";
import { GrantHubMigrationPage } from "./pages/GrantHubMigrationPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { EligibilityWizardPage } from "./pages/EligibilityWizardPage";
import { ApprovalWorkflowsPage } from "./pages/ApprovalWorkflowsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { FundersPage } from "./pages/FundersPage";
import {
  ProfilePage,
  OrganizationPage,
  TeamPage,
  TeamPerformancePage,
  NotificationsPage,
  AlertsPage,
  CalendarPage,
  BillingPage,
  ReportsPage,
  DangerZonePage,
  PrivacyDataPage,
  AdminPage,
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
              <ScrollToTop />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/update-password" element={<UpdatePasswordPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/security" element={<SecurityPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/granthub-migration" element={<GrantHubMigrationPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />

                {/* Protected Routes */}
                <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
                {/* Redirect /saved to /pipeline with list view */}
                <Route path="/saved" element={<Navigate to="/pipeline?view=list" replace />} />
                <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
                <Route path="/pipeline/grant/:grantId" element={<ProtectedRoute><GrantDetailPage /></ProtectedRoute>} />
                <Route path="/funders" element={<ProtectedRoute><FundersPage /></ProtectedRoute>} />
                <Route path="/metrics" element={<ProtectedRoute><MetricsPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
                <Route path="/import/granthub" element={<ProtectedRoute><GrantHubImportPage /></ProtectedRoute>} />
                <Route path="/onboarding/eligibility" element={<ProtectedRoute><EligibilityWizardPage /></ProtectedRoute>} />

                {/* Protected Settings Routes */}
                <Route path="/settings/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/settings/org" element={<ProtectedRoute><OrganizationPage /></ProtectedRoute>} />
                <Route path="/settings/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                <Route path="/settings/team/performance" element={<ProtectedRoute><TeamPerformancePage /></ProtectedRoute>} />
                <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/settings/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
                <Route path="/settings/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/settings/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                <Route path="/settings/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings/workflows" element={<AdminRoute><ApprovalWorkflowsPage /></AdminRoute>} />
                <Route path="/settings/privacy" element={<ProtectedRoute><PrivacyDataPage /></ProtectedRoute>} />
                <Route path="/settings/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                <Route path="/settings/danger" element={<ProtectedRoute><DangerZonePage /></ProtectedRoute>} />

                {/* Approvals Routes */}
                <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />

                {/* 404 Catch-all Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
