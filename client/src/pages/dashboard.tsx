import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddVideoModal } from "@/components/add-video-modal";
import { TranscriptEditor } from "@/components/transcript-editor";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useState } from "react";
import {
  Video,
  FileText,
  Globe,
  List,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Redirect to home if not authenticated
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: tasks } = useQuery({
    queryKey: ["/api/tasks"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const handleEditVideo = (video: any) => {
    setSelectedVideo(video);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle size={14} />;
      case "processing":
        return <Clock size={14} />;
      case "error":
        return <AlertCircle size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
              <p className="text-sm text-muted-foreground">Overview of your tasks and system statistics</p>
            </div>
            <div className="flex items-center space-x-4">
              {(currentUser as any)?.role === 'admin' && (
                <Button onClick={() => setIsAddVideoOpen(true)} className="flex items-center space-x-2">
                  <Plus size={16} />
                  <span>Add Video</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8 overflow-y-auto h-full">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Videos</p>
                    <p className="text-3xl font-bold text-foreground">
                      {(stats as any)?.totalVideos || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Video className="text-primary" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Transcripts</p>
                    <p className="text-3xl font-bold text-foreground">
                      {(stats as any)?.totalTranscripts || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <FileText className="text-green-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Languages</p>
                    <p className="text-3xl font-bold text-foreground">
                      {(stats as any)?.totalLanguages || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                    <Globe className="text-yellow-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Playlists</p>
                    <p className="text-3xl font-bold text-foreground">
                      {(stats as any)?.totalPlaylists || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <List className="text-purple-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks Section */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">My Tasks</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = "/tasks"}>
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {(tasks as any) && (tasks as any).length > 0 ? (
                <div className="space-y-4">
                  {(tasks as any).slice(0, 5).map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-center space-x-4 p-4 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{task.description}</h4>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                          <span>Assigned to: {task.assignedToUser?.email || 'Unknown'}</span>
                          <span>{formatTimeAgo(task.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            task.status === 'Complete' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No tasks assigned</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tasks will appear here when they are assigned to you.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <AddVideoModal 
        isOpen={isAddVideoOpen} 
        onClose={() => setIsAddVideoOpen(false)} 
      />
      
      {selectedVideo && (
        <TranscriptEditor
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
