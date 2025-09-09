import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Table, Command, Utensils } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Mesas", href: "/dashboard/tables", icon: Table },
  { name: "Comandas", href: "/dashboard/commands", icon: Command },
  { name: "Cardápio", href: "/dashboard/menus", icon: Utensils },
];

export function MobileBottomNavbar() {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-lg md:hidden">
      <nav className="flex justify-around items-center h-16 px-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center p-2 rounded-md text-xs font-medium transition-colors duration-200",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-300"
              )
            }
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
