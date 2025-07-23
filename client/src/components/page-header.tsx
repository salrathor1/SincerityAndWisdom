import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return (
    <header className="bg-white border-b border-border px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {children}
          
          {/* User Profile & Logout */}
          <div className="flex items-center space-x-3 pl-4 border-l border-border">
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
              <p className="text-sm font-medium text-foreground truncate">
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
              onClick={() => window.location.href = "/api/logout"}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}