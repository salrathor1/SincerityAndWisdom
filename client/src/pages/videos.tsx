import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddVideoModal } from "@/components/add-video-modal";
import { TranscriptEditor } from "@/components/transcript-editor";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, ExternalLink, ArrowUpDown } from "lucide-react";

export default function Videos() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
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

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const filteredVideos = Array.isArray(videos) ? videos
    .filter((video: any) =>
      video.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      
      switch (sortBy) {
        case "oldest":
          return dateA - dateB;
        case "newest":
        default:
          return dateB - dateA;
      }
    }) : [];

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

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Videos</h2>
              <p className="text-sm text-muted-foreground">Manage your YouTube videos and transcripts</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search videos..."
                  className="pl-9 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <ArrowUpDown size={16} className="mr-2" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest to Oldest</SelectItem>
                  <SelectItem value="oldest">Oldest to Newest</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setIsAddVideoOpen(true)} className="flex items-center space-x-2">
                <Plus size={16} />
                <span>Add Video</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Videos Content */}
        <main className="p-8 overflow-y-auto h-full">
          {videosLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="aspect-video bg-slate-200 rounded-t-lg" />
                  <CardContent className="p-4">
                    <div className="h-4 bg-slate-200 rounded mb-2" />
                    <div className="h-3 bg-slate-200 rounded mb-1" />
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video: any) => (
                <Card key={video.id} className="group hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <img
                      src={video.thumbnailUrl || "/placeholder-video.jpg"}
                      alt={video.title}
                      className="aspect-video w-full object-cover rounded-t-lg"
                    />
                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(video.status)}`}
                      >
                        {video.status}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {video.duration || "N/A"}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-medium text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    
                    <div className="text-sm text-muted-foreground mb-3">
                      <p>
                        {video.transcripts?.length || 0} transcript{video.transcripts?.length !== 1 ? 's' : ''}
                      </p>
                      <p>{formatTimeAgo(video.createdAt)}</p>
                      {video.playlist && (
                        <p className="text-primary">{video.playlist.name}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditVideo(video)}
                        className="flex-1"
                      >
                        <Edit size={14} className="mr-1" />
                        Edit
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={32} className="text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchTerm ? "No videos found" : "No videos yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm 
                    ? `No videos match "${searchTerm}". Try a different search term.`
                    : "Get started by adding your first video."
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsAddVideoOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Video
                  </Button>
                )}
              </div>
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
