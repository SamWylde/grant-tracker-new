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
import { ErrorBoundary } from "./components/ErrorBoundary";
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
    <ErrorBoundary boundaryName="App" showDetails={true}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OrganizationProvider>
              <BrowserRouter>
                <ScrollToTop />
                <ErrorBoundary boundaryName="Router" showDetails={true}>
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

                    {/* Protected Routes - Core Features */}
                    <Route
                      path="/discover"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="DiscoverPage">
                            <DiscoverPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    {/* Redirect /saved to /pipeline with list view */}
                    <Route path="/saved" element={<Navigate to="/pipeline?view=list" replace />} />
                    <Route
                      path="/pipeline"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="PipelinePage">
                            <PipelinePage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pipeline/grant/:grantId"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="GrantDetailPage">
                            <GrantDetailPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/funders"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="FundersPage">
                            <FundersPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/metrics"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="MetricsPage">
                            <MetricsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="AnalyticsPage">
                            <AnalyticsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/activity"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="ActivityPage">
                            <ActivityPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/import/granthub"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="GrantHubImportPage">
                            <GrantHubImportPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/onboarding/eligibility"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="EligibilityWizardPage">
                            <EligibilityWizardPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Settings Routes */}
                    <Route
                      path="/settings/profile"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="ProfilePage">
                            <ProfilePage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/org"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="OrganizationPage">
                            <OrganizationPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/team"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="TeamPage">
                            <TeamPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/team/performance"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="TeamPerformancePage">
                            <TeamPerformancePage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/notifications"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="NotificationsPage">
                            <NotificationsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/alerts"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="AlertsPage">
                            <AlertsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/calendar"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="CalendarPage">
                            <CalendarPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/billing"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="BillingPage">
                            <BillingPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/reports"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="ReportsPage">
                            <ReportsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/workflows"
                      element={
                        <AdminRoute>
                          <ErrorBoundary boundaryName="ApprovalWorkflowsPage">
                            <ApprovalWorkflowsPage />
                          </ErrorBoundary>
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/settings/privacy"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="PrivacyDataPage">
                            <PrivacyDataPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/admin"
                      element={
                        <AdminRoute>
                          <ErrorBoundary boundaryName="AdminPage">
                            <AdminPage />
                          </ErrorBoundary>
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/settings/danger"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="DangerZonePage">
                            <DangerZonePage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />

                    {/* Approvals Routes */}
                    <Route
                      path="/approvals"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary boundaryName="ApprovalsPage">
                            <ApprovalsPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 Catch-all Route */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </ErrorBoundary>
              </BrowserRouter>
            </OrganizationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MantineProvider>
    </ErrorBoundary>
  );
}
