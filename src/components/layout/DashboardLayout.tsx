import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { useTheme } from "next-themes";
import { useSidebar as useSidebarContext } from "@/components/ui/sidebar"; // Renamed to avoid conflict
import { 
  Home, 
  UserIcon, 
  Settings, 
  FileSignature, 
  Table, 
  Command, 
  BookOpen, 
  Bell,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Utensils
} from "lucide-react";

import { useSidebar as useSidebarContext } from "@/components/ui/sidebar"; // Renamed to avoid conflict
import { MobileBottomNavbar } from "@/components/layout/MobileBottomNavbar"; // New import

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  
  { name: "Mesas", href: "/dashboard/tables", icon: Table },
  { name: "Comandas", href: "/dashboard/commands", icon: Command },
  { name: "Cardápio", href: "/dashboard/menus", icon: Utensils },
];

function DashboardSidebar() {
  const { isMobile, setOpenMobile, state } = useSidebar(); // Access isMobile, setOpenMobile, and state from useSidebar

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-qr-code h-4 w-4 text-primary"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>
            Ágil QR
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <NavLink 
                    to={item.href}
                    className={({ isActive }) => 
                      cn(
                        "flex items-center gap-2 rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground"
                      )
                    }
                    onClick={() => {
                      if (isMobile) {
                        setOpenMobile(false); // Close sidebar on mobile after click
                      }
                    }}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className={cn(state === "collapsed" && "hidden")}>{item.name}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function DashboardHeader({ isMobile }: { isMobile: boolean }) {
  const { setTheme, theme } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {!isMobile && <SidebarTrigger />}
          
        </div>
        
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {theme === "light" ? <Sun className="h-4 w-4" /> : 
                 theme === "dark" ? <Moon className="h-4 w-4" /> : 
                 <Monitor className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/notifications")}>
            <Bell className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback>
                    {user?.firstName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                {user?.emailAddresses[0]?.emailAddress}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { console.log("Navigating to /dashboard/profile"); navigate("/dashboard/profile"); }}>
                <UserIcon className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { console.log("Navigating to /dashboard/signature"); navigate("/dashboard/signature"); }}>
                <FileSignature className="mr-2 h-4 w-4" />
                Assinatura
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { console.log("Navigating to /dashboard/settings"); navigate("/dashboard/settings"); }}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { console.log("Navigating to /dashboard/platform-guide"); navigate("/dashboard/platform-guide"); }}>
                <BookOpen className="mr-2 h-4 w-4" />
                Guia da Plataforma
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useSidebarContext(); // Now this hook is called within the provider's scope

  return (
    <div className={cn(
      "min-h-screen flex w-full",
      isMobile ? "flex-col" : "flex-row" // Stack on mobile, side-by-side on desktop
    )}>
      {/* Desktop Sidebar */}
      <div className={cn(isMobile ? "hidden" : "block")}>
        <DashboardSidebar />
      </div>

      <div className={cn(
        "flex-1 flex flex-col",
        isMobile ? "pb-16" : "pb-0" // Add padding for bottom navbar on mobile
      )}>
        <DashboardHeader isMobile={isMobile} />
        <main className="flex-1 p-6">
          {children} {/* Render Outlet here */}
        </main>
      </div>

      {/* Mobile Bottom Navbar */}
      <div className={cn(isMobile ? "block" : "hidden")}>
        <MobileBottomNavbar />
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>
        <Outlet key={location.pathname} />
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}