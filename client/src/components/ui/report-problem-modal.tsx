import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Playlist, Video } from "@shared/schema";

interface ReportProblemModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentVideo?: Video;
  currentPlaylist?: Playlist;
}

export function ReportProblemModal({ isOpen, onOpenChange, currentVideo, currentPlaylist }: ReportProblemModalProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [segmentIndex, setSegmentIndex] = useState<string>("");
  const [description, setDescription] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch playlists for the dropdown
  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });

  // Fetch videos for selected playlist
  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ["/api/playlists", selectedPlaylistId, "videos"],
    enabled: !!selectedPlaylistId,
  });

  // Set default values when modal opens
  useEffect(() => {
    if (isOpen && currentVideo && currentPlaylist) {
      setSelectedPlaylistId(currentPlaylist.id.toString());
      setSelectedVideoId(currentVideo.id.toString());
    }
  }, [isOpen, currentVideo, currentPlaylist]);

  const reportMutation = useMutation({
    mutationFn: async (data: {
      playlistId?: number;
      videoId?: number;
      segmentIndex?: number;
      description: string;
    }) => {
      await apiRequest("/api/reported-issues", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Problem Reported",
        description: "Your report has been submitted successfully. We'll look into it.",
      });
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/reported-issues"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to submit problem report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedPlaylistId("");
    setSelectedVideoId("");
    setSegmentIndex("");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please provide a description of the problem.",
        variant: "destructive",
      });
      return;
    }

    reportMutation.mutate({
      playlistId: selectedPlaylistId ? parseInt(selectedPlaylistId) : undefined,
      videoId: selectedVideoId ? parseInt(selectedVideoId) : undefined,
      segmentIndex: segmentIndex ? parseInt(segmentIndex) : undefined,
      description: description.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Problem</DialogTitle>
          <DialogDescription>
            Help us improve by reporting any issues you encounter. All fields are optional except the description.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playlist">Playlist (Optional)</Label>
            <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a playlist" />
              </SelectTrigger>
              <SelectContent>
                {playlists.map((playlist) => (
                  <SelectItem key={playlist.id} value={playlist.id.toString()}>
                    {playlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video">Video (Optional)</Label>
            <Select 
              value={selectedVideoId} 
              onValueChange={setSelectedVideoId}
              disabled={!selectedPlaylistId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a video" />
              </SelectTrigger>
              <SelectContent>
                {videos.map((video) => (
                  <SelectItem key={video.id} value={video.id.toString()}>
                    {video.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segment Index (Optional)</Label>
            <Input
              id="segment"
              type="number"
              placeholder="e.g., 5"
              value={segmentIndex}
              onChange={(e) => setSegmentIndex(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description of the Problem *</Label>
            <Textarea
              id="description"
              placeholder="Please describe the problem you encountered..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={reportMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={reportMutation.isPending || !description.trim()}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}