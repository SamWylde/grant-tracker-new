import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { lazy, Suspense } from "react";
import { MantineProvider, Loader, Center, Stack, Text } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { theme } from "./theme";

// Loading fallback component
const LoadingFallback = () => (
  <Center h="100vh">
    <Stack align="center" gap="md">
      <Loader size="lg" />
      <Text c="dimmed">Loading...</Text>
    </Stack>
  </Center>
);

// Lazy load all page components for code splitting
const HomePage = lazy(() => import("./pages/HomePage").then(m => ({ default: m.HomePage })));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const UpdatePasswordPage = lazy(() => import("./pages/UpdatePasswordPage"));
const PricingPage = lazy(() => import("./pages/PricingPage").then(m => ({ default: m.PricingPage })));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage").then(m => ({ default: m.FeaturesPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./pages/TermsPage").then(m => ({ default: m.TermsPage })));
const SecurityPage = lazy(() => import("./pages/SecurityPage").then(m => ({ default: m.SecurityPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then(m => ({ default: m.SupportPage })));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage").then(m => ({ default: m.DiscoverPage })));
const PipelinePage = lazy(() => import("./pages/PipelinePage").then(m => ({ default: m.PipelinePage })));
const GrantDetailPage = lazy(() => import("./pages/GrantDetailPage").then(m => ({ default: m.GrantDetailPage })));
const MetricsPage = lazy(() => import("./pages/MetricsPage").then(m => ({ default: m.MetricsPage })));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
const ActivityPage = lazy(() => import("./pages/ActivityPage").then(m => ({ default: m.ActivityPage })));
const GrantHubImportPage = lazy(() => import("./pages/GrantHubImportPage").then(m => ({ default: m.GrantHubImportPage })));
const GrantHubMigrationPage = lazy(() => import("./pages/GrantHubMigrationPage").then(m => ({ default: m.GrantHubMigrationPage })));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage").then(m => ({ default: m.AcceptInvitePage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const EligibilityWizardPage = lazy(() => import("./pages/EligibilityWizardPage").then(m => ({ default: m.EligibilityWizardPage })));
const ApprovalWorkflowsPage = lazy(() => import("./pages/ApprovalWorkflowsPage").then(m => ({ default: m.ApprovalWorkflowsPage })));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage").then(m => ({ default: m.ApprovalsPage })));
const FundersPage = lazy(() => import("./pages/FundersPage").then(m => ({ default: m.FundersPage })));

// Settings pages
const ProfilePage = lazy(() => import("./pages/settings").then(m => ({ default: m.ProfilePage })));
const OrganizationPage = lazy(() => import("./pages/settings").then(m => ({ default: m.OrganizationPage })));
const TeamPage = lazy(() => import("./pages/settings").then(m => ({ default: m.TeamPage })));
const TeamPerformancePage = lazy(() => import("./pages/settings").then(m => ({ default: m.TeamPerformancePage })));
const NotificationsPage = lazy(() => import("./pages/settings").then(m => ({ default: m.NotificationsPage })));
const AlertsPage = lazy(() => import("./pages/settings").then(m => ({ default: m.AlertsPage })));
const CalendarPage = lazy(() => import("./pages/settings").then(m => ({ default: m.CalendarPage })));
const BillingPage = lazy(() => import("./pages/settings").then(m => ({ default: m.BillingPage })));
const ReportsPage = lazy(() => import("./pages/settings").then(m => ({ default: m.ReportsPage })));
const DangerZonePage = lazy(() => import("./pages/settings").then(m => ({ default: m.DangerZonePage })));
const PrivacyDataPage = lazy(() => import("./pages/settings").then(m => ({ default: m.PrivacyDataPage })));
const AdminPage = lazy(() => import("./pages/settings").then(m => ({ default: m.AdminPage })));

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
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OrganizationProvider>
              <BrowserRouter>
                <ScrollToTop />
                <ErrorBoundary boundaryName="Router" showDetails={true}>
                  <Suspense fallback={<LoadingFallback />}>
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
                  </Suspense>
                </ErrorBoundary>
              </BrowserRouter>
            </OrganizationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MantineProvider>
    </ErrorBoundary>
  );
}
