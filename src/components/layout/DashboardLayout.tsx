import { Outlet } from "react-router-dom";
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
  Monitor
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Perfil", href: "/dashboard/profile", icon: UserIcon },
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
  { name: "Assinatura", href: "/dashboard/signature", icon: FileSignature },
  { name: "Mesas", href: "/dashboard/tables", icon: Table },
  { name: "Comandas", href: "/dashboard/commands", icon: Command },
  { name: "Guia da Plataforma", href: "/dashboard/platform-guide", icon: BookOpen },
  { name: "Notificações", href: "/dashboard/notifications", icon: Bell },
];

function DashboardSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Ágil QR</SidebarGroupLabel>
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
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
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
  const { setTheme, theme } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-xl font-semibold">Dashboard</h1>
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

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}