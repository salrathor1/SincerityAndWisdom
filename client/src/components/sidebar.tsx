import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { 
  Video, 
  Home, 
  List, 
  FileText, 
  Languages,
  BookOpen,
  BarChart3, 
  LogOut,
  User,
  Shield,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Videos", href: "/videos", icon: Video },
  { name: "Playlists", href: "/playlists", icon: List },
  { name: "Transcripts", href: "/transcripts", icon: FileText },
  { name: "Arabic Transcripts", href: "/arabic-transcripts", icon: BookOpen },
  { name: "Translations", href: "/translations", icon: Languages },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isAuthenticated,
  }) as { data: any };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <>
      {/* Collapsed Tab */}
      {isCollapsed && (
        <div className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50">
          <button
            onClick={() => setIsCollapsed(false)}
            className="bg-white shadow-lg border border-border rounded-r-lg p-2 hover:bg-gray-50 transition-colors flex items-center space-x-1"
          >
            <ChevronRight size={16} className="text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">Expand</span>
          </button>
        </div>
      )}
      
      <div className={cn(
        "bg-white shadow-sm border-r border-border flex flex-col h-screen transition-all duration-300",
        isCollapsed ? "w-0 overflow-hidden" : "w-64"
      )}>
        {/* Logo/Brand */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M9 12c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.22-1.21 4.15-3 5.19V22h-6v-4.81c-1.79-1.04-3-2.97-3-5.19z" fill="currentColor"/>
                  <circle cx="15" cy="12" r="2" fill="#059669"/>
                  <path d="m11 17 4 4V15z" fill="#059669"/>
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-foreground">The Sunnah and Wisdom</h1>
            </div>
            
            {/* Collapse Button */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              // Role-based access control for specialized editors
              if (currentUser?.role === 'arabic_transcripts_editor') {
                // Show only Arabic Transcripts for Arabic Transcripts Editor
                if (item.href !== '/arabic-transcripts') {
                  return null;
                }
              } else if (currentUser?.role === 'translations_editor') {
                // Show only Translations for Translations Editor
                if (item.href !== '/translations') {
                  return null;
                }
              } else {
                // For admin and other roles, apply standard filtering
                if (item.href === '/arabic-transcripts' && 
                    currentUser && !['admin', 'arabic_transcripts_editor'].includes(currentUser.role)) {
                  return null;
                }
                
                if (item.href === '/translations' && 
                    currentUser && !['admin', 'translations_editor'].includes(currentUser.role)) {
                  return null;
                }
              }
              
              return (
                <li key={item.name}>
                  <Link href={item.href}>
                    <a
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon size={20} />
                      <span>{item.name}</span>
                    </a>
                  </Link>
                </li>
              );
            })}
            
            
            {/* Admin Panel Link (Admin Only) */}
            {currentUser?.role === 'admin' && (
              <li>
                <Link href="/admin">
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors border-t border-border mt-4 pt-4",
                      location === "/admin"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "text-red-600 hover:bg-red-50 hover:text-red-700"
                    )}
                  >
                    <Shield size={20} />
                    <span className="font-medium">Admin Panel</span>
                  </a>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarImage 
                src={currentUser?.profileImageUrl || ""} 
                alt={currentUser?.firstName || "User"} 
                className="object-cover"
              />
              <AvatarFallback>
                <User size={16} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {currentUser?.firstName && currentUser?.lastName 
                  ? `${currentUser.firstName} ${currentUser.lastName}`
                  : currentUser?.email || "Admin User"
                }
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentUser?.email || "admin@example.com"}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
    </div>
    </>
  );
}
