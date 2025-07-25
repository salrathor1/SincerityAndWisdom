import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Search, Edit, Trash2, Video, Eye, X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Playlist name is required"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Playlists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<any>(null);
  const [viewingPlaylist, setViewingPlaylist] = useState<any>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

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

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ["/api/playlists"],
    retry: false,
  });

  // Fetch videos for selected playlist
  const { data: playlistVideos = [] } = useQuery({
    queryKey: ["/api/playlists", viewingPlaylist?.id, "videos"],
    enabled: !!viewingPlaylist?.id,
    retry: false,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest("POST", "/api/playlists", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Playlist created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      setIsCreateOpen(false);
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
        description: error.message || "Failed to create playlist",
        variant: "destructive",
      });
    },
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      await apiRequest("PUT", `/api/playlists/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Playlist updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      form.reset();
      setEditingPlaylist(null);
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
        description: error.message || "Failed to update playlist",
        variant: "destructive",
      });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/playlists/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Playlist deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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
        description: error.message || "Failed to delete playlist",
        variant: "destructive",
      });
    },
  });

  const removeVideoFromPlaylistMutation = useMutation({
    mutationFn: async ({ videoId }: { videoId: number }) => {
      await apiRequest("PUT", `/api/videos/${videoId}`, { playlistId: null });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Video removed from playlist successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", viewingPlaylist?.id, "videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
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
        description: error.message || "Failed to remove video from playlist",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const filteredPlaylists = playlists?.filter((playlist: any) =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSubmit = (data: FormData) => {
    if (editingPlaylist) {
      updatePlaylistMutation.mutate({ id: editingPlaylist.id, data });
    } else {
      createPlaylistMutation.mutate(data);
    }
  };

  const handleEdit = (playlist: any) => {
    setEditingPlaylist(playlist);
    form.reset({
      name: playlist.name,
      description: playlist.description || "",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) {
      deletePlaylistMutation.mutate(id);
    }
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditingPlaylist(null);
    form.reset();
  };

  const handleRemoveVideo = (videoId: number) => {
    if (confirm("Are you sure you want to remove this video from the playlist?")) {
      removeVideoFromPlaylistMutation.mutate({ videoId });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Playlists</h2>
              <p className="text-sm text-muted-foreground">Organize your videos into playlists</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search playlists..."
                  className="pl-9 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="flex items-center space-x-2">
                <Plus size={16} />
                <span>Create Playlist</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Playlists Content */}
        <main className="p-8 overflow-y-auto h-full">
          {playlistsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-slate-200 rounded mb-2" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-slate-200 rounded mb-2" />
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlaylists.map((playlist: any) => (
                <Card key={playlist.id} className="group hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {playlist.name}
                        </CardTitle>
                        {playlist.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {playlist.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(playlist)}
                          title="Edit playlist"
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(playlist.id)}
                          className="text-destructive hover:text-destructive"
                          title="Delete playlist"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <div className="flex items-center space-x-1">
                        <Video size={14} />
                        <span>
                          {playlist.videos?.length || 0} video{playlist.videos?.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span>{formatTimeAgo(playlist.createdAt)}</span>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingPlaylist(playlist)}
                      className="w-full"
                    >
                      <Eye size={14} className="mr-2" />
                      View Videos
                    </Button>
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
                  {searchTerm ? "No playlists found" : "No playlists yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm 
                    ? `No playlists match "${searchTerm}". Try a different search term.`
                    : "Create your first playlist to organize your videos."
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Playlist
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create/Edit Playlist Dialog */}
      <Dialog open={isCreateOpen || !!editingPlaylist} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlaylist ? "Edit Playlist" : "Create New Playlist"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Playlist Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter playlist name..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter playlist description..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPlaylistMutation.isPending || updatePlaylistMutation.isPending}
                >
                  {(createPlaylistMutation.isPending || updatePlaylistMutation.isPending)
                    ? "Saving..." 
                    : editingPlaylist 
                    ? "Update Playlist" 
                    : "Create Playlist"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Playlist Videos Dialog */}
      <Dialog open={!!viewingPlaylist} onOpenChange={() => setViewingPlaylist(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">
                  {viewingPlaylist?.name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {playlistVideos.length} video{playlistVideos.length !== 1 ? 's' : ''} in this playlist
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingPlaylist(null)}
              >
                <X size={16} />
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4">
            {playlistVideos.length > 0 ? (
              <div className="space-y-4">
                {playlistVideos.map((video: any) => (
                  <Card key={video.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <img
                          src={video.thumbnailUrl || "/placeholder-video.jpg"}
                          alt={video.title}
                          className="w-32 h-18 object-cover rounded-lg flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground mb-2 line-clamp-2">
                            {video.title}
                          </h4>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <span>Duration: {video.duration || 'Unknown'}</span>
                            <span>
                              {video.transcripts?.length || 0} transcript{video.transcripts?.length !== 1 ? 's' : ''}
                            </span>
                            <span>Added {formatTimeAgo(video.createdAt)}</span>
                          </div>
                          
                          {video.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {video.description}
                            </p>
                          )}
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
                  Videos can be added to playlists when editing them in the transcript editor.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
