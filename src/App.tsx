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
import Index from "./pages/Index";
import ArcherHome from "./pages/archer/Home";
import ExperiencePage from "./pages/archer/Experience";
import {
  WhyArcherPage,
  PricingPage,
  FAQPage,
  AboutPage,
  ContactPage,
  FeaturesCampaignsPage,
  FeaturesReviewsPage,
  FeaturesEngagementPage,
  FeaturesEnterprisePage,
} from "./pages/archer/SubPages";
import { PrivacyPage, TermsPage, HipaaPage } from "./pages/archer/LegalPages";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CampaignEditNew from "./pages/CampaignEditNew";
import ChannelEdit from "./pages/ChannelEdit";
import AdminDashboard from "./pages/AdminDashboard";
import AccountProfile from "./pages/AccountProfile";
import Schedule from "./pages/Schedule";
import KnowledgeBase from "./pages/KnowledgeBase";
import ManagerDashboard from "./pages/ManagerDashboard";
import NotFound from "./pages/NotFound";
import LandingView from "./pages/LandingView";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import AcceptInvite from "./pages/AcceptInvite";
import BundleSocialSmokeTest from "./pages/BundleSocialSmokeTest";

const queryClient = new QueryClient();

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
