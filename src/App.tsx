import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import ArcherHome from "./pages/archer/Home";
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

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campaign/:id" element={<CampaignEditNew />} />
            <Route path="/campaign/edit/:id" element={<CampaignEditNew />} />
            <Route path="/campaign/:id/channel/:channelId" element={<ChannelEdit />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/account/:userId" element={<AccountProfile />} />
            <Route path="/account/:userId" element={<AccountProfile />} />
            <Route path="/manager/account/:userId" element={<AccountProfile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
