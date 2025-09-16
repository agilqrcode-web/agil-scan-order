import SSOCallback from "./pages/SSOCallback";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Profile from "./pages/dashboard/Profile";
import Settings from "./pages/dashboard/Settings";
import Signature from "./pages/dashboard/Signature";
import Tables from "./pages/dashboard/Tables";
import Commands from "./pages/dashboard/Commands";
import PlatformGuide from "./pages/dashboard/PlatformGuide";
import Notifications from "./pages/dashboard/Notifications";
import Menus from "./pages/dashboard/Menus";
import MenuEditor from "./pages/dashboard/MenuEditor";
import EditRestaurant from "./pages/dashboard/EditRestaurant";
import PublicMenu from "./pages/PublicMenu";

const queryClient = new QueryClient();

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/precos" element={<Pricing />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/registro" element={<Auth />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/sso-callback" element={<SSOCallback />} />
              
              {/* Onboarding Route */}
              <Route path="/onboarding" element={
                <ProtectedRoute requireCompleteProfile={false}>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              {/* Protected Dashboard Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="signature" element={<Signature />} />
                <Route path="tables" element={<Tables />} />
                <Route path="commands" element={<Commands />} />
                <Route path="platform-guide" element={<PlatformGuide />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="menus" element={<Menus />} />
                <Route path="menus/:menuId/edit" element={<MenuEditor />} />
                <Route path="restaurants/:restaurantId/edit" element={<EditRestaurant />} />
              </Route>
              
              <Route path="/menus/:menuId" element={<PublicMenu />} />
              <Route path="/order-status/:orderId" element={<OrderStatus />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;