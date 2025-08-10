import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Edit, Save, ExternalLink, Check } from "lucide-react";

interface TranscriptEditorProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function TranscriptEditor({ video, isOpen, onClose }: TranscriptEditorProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const playerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  
  // Edit states
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [isEditingLanguages, setIsEditingLanguages] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // Permission check
  const canEdit = currentUser && ['admin'].includes(currentUser.role);

  // Language options
  const languageOptions = [
    { code: 'ar', name: 'Arabic' },
    { code: 'en', name: 'English' },
    { code: 'ur', name: 'Urdu' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ms', name: 'Malay' }
  ];

  // Initialize states when video changes
  useEffect(() => {
    if (video) {
      setVideoUrl(`https://www.youtube.com/watch?v=${video.youtubeId}`);
      setSelectedLanguages(video.languages || []);
    }
  }, [video]);

  // YouTube Player initialization
  useEffect(() => {
    if (!isOpen || !video) return;

    const initializePlayer = () => {
      if (window.YT && window.YT.Player && playerRef.current) {
        ytPlayerRef.current = new window.YT.Player(playerRef.current, {
          height: '100%',
          width: '100%',
          videoId: video.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event: any) => {
              console.log('Player ready for:', video.title);
            },
          },
        });
      }
    };

    if (window.YT && window.YT.loaded) {
      initializePlayer();
    } else {
      window.onYouTubeIframeAPIReady = initializePlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.log('Error destroying player:', e);
        }
        ytPlayerRef.current = null;
      }
    };
  }, [isOpen, video]);

  // Update video URL mutation
  const updateVideoUrlMutation = useMutation({
    mutationFn: async ({ videoId, youtubeUrl }: { videoId: number; youtubeUrl: string }) => {
      return apiRequest(`/api/videos/${videoId}`, {
        method: 'PATCH',
        body: { youtubeUrl },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
      toast({
        title: "Success",
        description: "Video URL updated successfully",
      });
      setIsEditingUrl(false);
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
        description: `Failed to update video URL: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update languages mutation
  const updateLanguagesMutation = useMutation({
    mutationFn: async ({ videoId, languages }: { videoId: number; languages: string[] }) => {
      return apiRequest(`/api/videos/${videoId}`, {
        method: 'PATCH',
        body: { languages },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
      toast({
        title: "Success",
        description: "Video languages updated successfully",
      });
      setIsEditingLanguages(false);
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
        description: `Failed to update video languages: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleUpdateVideoUrl = () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      });
      return;
    }

    updateVideoUrlMutation.mutate({ videoId: video.id, youtubeUrl: videoUrl });
  };

  const handleSaveLanguages = () => {
    updateLanguagesMutation.mutate({ videoId: video.id, languages: selectedLanguages });
  };

  const handleCancelLanguagesEdit = () => {
    setSelectedLanguages(video.languages || []);
    setIsEditingLanguages(false);
  };

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <DialogTitle className="text-xl font-semibold">Video Details</DialogTitle>
              <Badge variant="outline" className="text-xs">
                {video.playlistId ? `Playlist ${video.playlistId}` : 'No Playlist'}
              </Badge>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Language:</span>
                <Select defaultValue="ar" disabled>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/landing?playlist=${video.playlistId}&video=${video.id}`, '_blank');
                }}
                className="flex items-center space-x-1 text-xs"
                title="View video on landing page"
              >
                <ExternalLink size={12} />
                <span>View Video</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                aria-label="Close transcript editor"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[calc(90vh-120px)] overflow-hidden">
          {/* Video Player - Full Width */}
          <div className="w-full max-w-4xl mx-auto p-8 flex flex-col">
            <div className="aspect-video bg-slate-900 rounded-lg mb-6 relative overflow-hidden flex-shrink-0">
              <div
                ref={playerRef}
                className="w-full h-full"
              />
            </div>

            {/* Video Info - Enhanced Layout */}
            <div className="space-y-6 overflow-y-auto flex-1">
              {/* Video Title */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">{video.title}</h2>
                <p className="text-sm text-muted-foreground">Duration: {video.duration}</p>
              </div>
              
              {/* Video URL Editor */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Video URL:</label>
                  {canEdit && !isEditingUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingUrl(true)}
                      className="h-7 px-3 text-xs"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingUrl ? (
                  <div className="space-y-3">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-sm border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg px-3 py-2 transition-all duration-200"
                      disabled={updateVideoUrlMutation.isPending}
                    />
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateVideoUrl}
                        disabled={updateVideoUrlMutation.isPending}
                        className="h-8 px-3 text-xs"
                      >
                        <Save size={14} className="mr-1" />
                        {updateVideoUrlMutation.isPending ? "Updating..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVideoUrl(`https://www.youtube.com/watch?v=${video.youtubeId}`);
                          setIsEditingUrl(false);
                        }}
                        disabled={updateVideoUrlMutation.isPending}
                        className="h-8 px-3 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm bg-white dark:bg-gray-800 p-3 rounded border font-mono break-all">
                    {videoUrl}
                  </div>
                )}
              </div>

              {/* Available Languages */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Available Languages:</label>
                  {canEdit && !isEditingLanguages && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingLanguages(true)}
                      className="h-7 px-3 text-xs"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingLanguages ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {languageOptions.map(lang => (
                        <label key={lang.code} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={selectedLanguages.includes(lang.code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLanguages([...selectedLanguages, lang.code]);
                              } else {
                                setSelectedLanguages(selectedLanguages.filter(code => code !== lang.code));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{lang.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleSaveLanguages}
                        disabled={updateLanguagesMutation.isPending}
                        className="h-8 px-3 text-xs"
                      >
                        <Save size={14} className="mr-1" />
                        {updateLanguagesMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelLanguagesEdit}
                        disabled={updateLanguagesMutation.isPending}
                        className="h-8 px-3 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                    {currentUser?.role !== 'admin' && (
                      <p className="text-xs text-muted-foreground">
                        Note: Only admins can remove languages. You can add new ones.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguages.length > 0 ? (
                      selectedLanguages.map(code => (
                        <Badge key={code} variant="secondary" className="text-xs">
                          {languageOptions.find(l => l.code === code)?.name || code}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No languages available</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                <p>Use the YouTube player controls above to play, pause, and seek through the video.</p>
                <p>Edit video details using the controls above.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}