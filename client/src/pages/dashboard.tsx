import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddVideoModal } from "@/components/add-video-modal";
import { TranscriptEditor } from "@/components/transcript-editor";
import { UserManagement } from "@/components/user-management";
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

  const { data: recentVideos } = useQuery({
    queryKey: ["/api/videos"],
    retry: false,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
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
        <PageHeader 
          title="Dashboard" 
          description="Manage your YouTube video transcripts"
        >
          {currentUser?.role === 'admin' && (
            <Button onClick={() => setIsAddVideoOpen(true)} className="flex items-center space-x-2">
              <Plus size={16} />
              <span>Add Video</span>
            </Button>
          )}
        </PageHeader>

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
                      {stats?.totalVideos || 0}
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
                      {stats?.totalTranscripts || 0}
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
                      {stats?.totalLanguages || 0}
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
                      {stats?.totalPlaylists || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <List className="text-purple-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Videos Section */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Recent Videos</CardTitle>
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {recentVideos && recentVideos.length > 0 ? (
                <div className="space-y-4">
                  {recentVideos.slice(0, 5).map((video: any) => (
                    <div
                      key={video.id}
                      className="flex items-center space-x-4 p-4 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <img
                        src={video.thumbnailUrl || "/placeholder-video.jpg"}
                        alt={video.title}
                        className="w-16 h-9 rounded object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{video.title}</h4>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                          <span>{video.duration || "N/A"}</span>
                          <span>
                            {video.transcripts?.length || 0} transcript{video.transcripts?.length !== 1 ? 's' : ''}
                          </span>
                          <span>{formatTimeAgo(video.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getStatusColor(video.status)}`}
                        >
                          {getStatusIcon(video.status)}
                          <span className="capitalize">{video.status}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditVideo(video)}
                        >
                          <Edit size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No videos yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by adding your first video.
                  </p>
                  {currentUser?.role === 'admin' && (
                    <div className="mt-6">
                      <Button onClick={() => setIsAddVideoOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Video
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Management Section (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <div className="mb-8">
              <UserManagement />
            </div>
          )}
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
