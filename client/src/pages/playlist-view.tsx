import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ArrowLeft, Video, Trash2, GripVertical } from "lucide-react";

export default function PlaylistView() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  // Extract playlist ID from URL path
  const playlistId = location.split("/")[2]; // /playlists/123 -> 123

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

  // Fetch playlist details
  const { data: playlist, isLoading: playlistLoading } = useQuery({
    queryKey: [`/api/playlists/${playlistId}`],
    enabled: !!playlistId,
    retry: false,
  });

  // Fetch playlist videos
  const { data: playlistVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: [`/api/playlists/${playlistId}/videos`],
    enabled: !!playlistId,
    retry: false,
  });

  // Remove video from playlist mutation
  const removeVideoFromPlaylistMutation = useMutation({
    mutationFn: async ({ videoId }: { videoId: number }) => {
      await apiRequest("DELETE", `/api/playlists/${playlistId}/videos/${videoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/playlists/${playlistId}/videos`] });
      toast({
        title: "Success",
        description: "Video removed from playlist",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to remove video from playlist",
        variant: "destructive",
      });
    },
  });

  // Update video order mutation
  const updateVideoOrderMutation = useMutation({
    mutationFn: async ({ videoId, playlistOrder }: { videoId: number; playlistOrder: number }) => {
      await apiRequest("PUT", `/api/videos/${videoId}`, { playlistOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/playlists/${playlistId}/videos`] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      console.error("Failed to update video order:", error);
    },
  });

  const handleRemoveVideo = (videoId: number) => {
    if (confirm("Are you sure you want to remove this video from the playlist?")) {
      removeVideoFromPlaylistMutation.mutate({ videoId });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(index);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Create a new array with reordered items
    const newVideos = [...playlistVideos];
    const draggedVideo = newVideos[draggedItem];
    
    // Remove the dragged item
    newVideos.splice(draggedItem, 1);
    
    // Insert at new position
    newVideos.splice(dropIndex, 0, draggedVideo);
    
    // Update the order values
    const updatedVideos = newVideos.map((video, index) => ({
      ...video,
      playlistOrder: index + 1
    }));

    // Update each video's playlist order
    updatedVideos.forEach((video, index) => {
      if (video.playlistOrder !== playlistVideos.find((v: any) => v.id === video.id)?.playlistOrder) {
        updateVideoOrderMutation.mutate({ 
          videoId: video.id, 
          playlistOrder: index + 1 
        });
      }
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  if (!playlistId) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Invalid Playlist</h2>
            <p className="text-gray-600">Please select a valid playlist to view.</p>
            <Button 
              className="mt-4"
              onClick={() => window.location.href = "/playlists"}
            >
              Back to Playlists
            </Button>
          </div>
        </div>
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
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.location.href = "/playlists"}
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Playlists
              </Button>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {playlistLoading ? "Loading..." : playlist?.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {videosLoading ? "Loading videos..." : `${playlistVideos.length} video${playlistVideos.length !== 1 ? 's' : ''} in this playlist`}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-8 overflow-y-auto h-full">
          {videosLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className="w-32 h-18 bg-slate-200 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 rounded mb-2" />
                        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-200 rounded w-1/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : playlistVideos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-4">
                💡 Drag and drop videos to reorder them in the playlist
              </p>
              {playlistVideos
                .sort((a: any, b: any) => (a.playlistOrder || 0) - (b.playlistOrder || 0))
                .map((video: any, index: number) => (
                <Card 
                  key={video.id} 
                  className={`group hover:shadow-md transition-all cursor-move ${
                    dragOverItem === index ? 'border-blue-500 bg-blue-50' : ''
                  } ${draggedItem === index ? 'opacity-50 scale-95' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex items-center space-x-2">
                        <GripVertical 
                          size={16} 
                          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" 
                        />
                        <img
                          src={video.thumbnailUrl || "/placeholder-video.jpg"}
                          alt={video.title}
                          className="w-32 h-18 object-cover rounded-lg flex-shrink-0"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
                          {video.title}
                        </h4>
                        {video.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {video.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')} • 
                          Order: {video.playlistOrder || index + 1}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveVideo(video.id)}
                          disabled={removeVideoFromPlaylistMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} className="mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No videos in this playlist
              </h3>
              <p className="text-muted-foreground">
                Videos can be added to playlists when editing them in the videos page.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}