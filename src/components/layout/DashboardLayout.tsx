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
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { useTheme } from "next-themes";
import { useSidebar } from "@/components/ui/sidebar";
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
  Utensils,
  ArrowLeft
} from "lucide-react";
import { MobileBottomNavbar } from "@/components/layout/MobileBottomNavbar";
import { useNotifications } from "@/hooks/useNotifications";
import { PageHeaderProvider, usePageHeader } from "@/contexts/PageHeaderContext";

import React from "react";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Mesas", href: "/dashboard/tables", icon: Table },
  { name: "Comandas", href: "/dashboard/commands", icon: Command },
  { name: "Cardápio", href: "/dashboard/menus", icon: Utensils },
];

function DashboardSidebar() {
  const { isMobile, setOpenMobile, state } = useSidebar();

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
                    onClick={() => { if (isMobile) setOpenMobile(false); }}
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

function DashboardHeader() {
  const { isMobile } = useSidebar();
  const { setTheme, theme } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { notificationsData } = useNotifications();
  const unreadCount = notificationsData?.stats.unread ?? 0;
  
  // Consumir o contexto do cabeçalho
  const { title, backButtonHref, headerActions } = usePageHeader();

  const handleSignOut = () => signOut();

  // Determina se os ícones globais devem ser mostrados no mobile
  const showGlobalIcons = !backButtonHref && !headerActions;

  return (
    <header className="h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex-1 flex items-center gap-2">
        {backButtonHref ? (
          <Button variant="ghost" size="icon" onClick={() => navigate(backButtonHref)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          !isMobile && <SidebarTrigger />
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      
      <div className="flex-1 flex items-center justify-end gap-2">
        {/* Ações de página (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
            {headerActions}
        </div>

        {/* Ícones Globais */}
        {(isMobile && showGlobalIcons) || !isMobile ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  {theme === "light" ? <Sun className="h-4 w-4" /> : theme === "dark" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 h-4 w-4" />Claro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 h-4 w-4" />Escuro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}><Monitor className="mr-2 h-4 w-4" />Sistema</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/notifications")} className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center rounded-full text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8"><AvatarImage src={user?.imageUrl} /><AvatarFallback>{user?.firstName?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>{user?.emailAddresses[0]?.emailAddress}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}><UserIcon className="mr-2 h-4 w-4" />Perfil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/signature")}><FileSignature className="mr-2 h-4 w-4" />Assinatura</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}><Settings className="mr-2 h-4 w-4" />Configurações</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/platform-guide")}><BookOpen className="mr-2 h-4 w-4" />Guia da Plataforma</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>
    </header>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useSidebar();
  const { fabAction, backButtonHref, headerActions } = usePageHeader();

  // Esconde a barra de navegação principal no mobile se a página for de edição (tiver ações)
  const showMobileNavbar = isMobile && !backButtonHref && !headerActions;

  useNotifications(); // Ensure notifications query is always active

  return (
    <div className={cn("min-h-screen w-full flex", isMobile ? "flex-col" : "flex-row")}>
      {!isMobile && <DashboardSidebar />}

      <div className={cn("flex-1 flex flex-col", showMobileNavbar ? "pb-16" : "pb-0")}>
        <DashboardHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* FAB (Mobile) */}
      {isMobile && fabAction && (
        <div className="fixed bottom-6 right-6 z-50">
            {fabAction}
        </div>
      )}

      {showMobileNavbar && <MobileBottomNavbar />}
    </div>
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  return (
    <SidebarProvider>
      <PageHeaderProvider>
        <DashboardLayoutContent>
          <Outlet />
        </DashboardLayoutContent>
      </PageHeaderProvider>
    </SidebarProvider>
  );
}