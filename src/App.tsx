import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RouteFallback } from "@/components/RouteFallback";

// Landing page stays eager — it's the "/" LCP path most first-time visitors hit.
import ArcherHome from "./pages/archer/Home";

// Everything else is code-split so the marketing landing bundle no longer ships
// the entire authenticated app (Dashboard, Admin, campaign editor, jspdf,
// emoji-picker, react-markdown, etc.). Each chunk loads on navigation.
const Index = lazy(() => import("./pages/Index"));
const ExperiencePage = lazy(() => import("./pages/archer/Experience"));
const WhyArcherPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.WhyArcherPage }))
);
const PricingPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.PricingPage }))
);
const FAQPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.FAQPage }))
);
const AboutPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.AboutPage }))
);
const ContactPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.ContactPage }))
);
const FeaturesCampaignsPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.FeaturesCampaignsPage }))
);
const FeaturesReviewsPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.FeaturesReviewsPage }))
);
const FeaturesEngagementPage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.FeaturesEngagementPage }))
);
const FeaturesEnterprisePage = lazy(() =>
  import("./pages/archer/SubPages").then((m) => ({ default: m.FeaturesEnterprisePage }))
);
const PrivacyPage = lazy(() =>
  import("./pages/archer/LegalPages").then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazy(() =>
  import("./pages/archer/LegalPages").then((m) => ({ default: m.TermsPage }))
);
const HipaaPage = lazy(() =>
  import("./pages/archer/LegalPages").then((m) => ({ default: m.HipaaPage }))
);
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CampaignEditNew = lazy(() => import("./pages/CampaignEditNew"));
const ChannelEdit = lazy(() => import("./pages/ChannelEdit"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AccountProfile = lazy(() => import("./pages/AccountProfile"));
const Schedule = lazy(() => import("./pages/Schedule"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingView = lazy(() => import("./pages/LandingView"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const BundleSocialSmokeTest = lazy(() => import("./pages/BundleSocialSmokeTest"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetch storms: data is considered fresh for 60s and we don't
      // refetch every time the window regains focus.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <ImpersonationProvider>
        <WorkspaceProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ImpersonationBanner />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<ArcherHome />} />
            <Route path="/get-started" element={<Index />} />
            <Route path="/why-archer" element={<WhyArcherPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/features/campaigns" element={<FeaturesCampaignsPage />} />
            <Route path="/features/reviews" element={<FeaturesReviewsPage />} />
            <Route path="/features/engagement" element={<FeaturesEngagementPage />} />
            <Route path="/features/enterprise" element={<FeaturesEnterprisePage />} />
            <Route path="/experience" element={<ExperiencePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/hipaa" element={<HipaaPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campaign/:id" element={<CampaignEditNew />} />
            <Route path="/campaign/:id/channel/:channelId" element={<ChannelEdit />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/account/:userId" element={<AccountProfile />} />
            <Route path="/account/:userId" element={<AccountProfile />} />
            <Route path="/manager/account/:userId" element={<AccountProfile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/landing/:id" element={<LandingView />} />
            <Route path="/settings/workspace" element={<WorkspaceSettings />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/dev/bundle-social" element={<BundleSocialSmokeTest />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </TooltipProvider>
        </WorkspaceProvider>
        </ImpersonationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
