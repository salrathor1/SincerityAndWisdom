import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { UserManagement } from "@/components/user-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Settings, Database } from "lucide-react";

export default function AdminPanel() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  }) as { data: any };

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (!isLoading && isAuthenticated && currentUser?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, currentUser, toast]);

  if (isLoading || !isAuthenticated || currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground flex items-center">
                <Shield className="mr-3 text-red-600" size={28} />
                Admin Panel
              </h2>
              <p className="text-sm text-muted-foreground">Manage users and system settings</p>
            </div>
          </div>
        </header>

        {/* Admin Content */}
        <main className="p-8 overflow-y-auto h-full">
          {/* Admin Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">System Status</p>
                    <p className="text-2xl font-bold text-green-600">Online</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <Database className="text-green-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold text-blue-600">1</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Users className="text-blue-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Admin Tools</p>
                    <p className="text-2xl font-bold text-purple-600">Active</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Settings className="text-purple-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management Section */}
          <div className="mb-8">
            <UserManagement />
          </div>

          {/* Additional Admin Sections can be added here */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings size={20} className="mr-2" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Additional admin settings and tools will be available here.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}