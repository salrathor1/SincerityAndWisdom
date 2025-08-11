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
  const [translationLanguage, setTranslationLanguage] = useState<string>("Arabic");
  const [segmentIndex, setSegmentIndex] = useState<string>("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactMobile, setContactMobile] = useState<string>("");
  
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
    if (isOpen) {
      // Common logic for language detection
      const detectLanguage = () => {
        const currentPath = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('language') || urlParams.get('lang');
        
        // Language code to display name mapping
        const languageMap: { [key: string]: string } = {
          'ar': 'Arabic',
          'en': 'English',
          'ur': 'Urdu',
          'fr': 'French',
          'es': 'Spanish',
          'tr': 'Turkish',
          'ms': 'Malay'
        };
        
        if (langParam && languageMap[langParam]) {
          return languageMap[langParam];
        } else if (currentPath.includes('translations')) {
          return "English"; // Default for translations page
        } else if (currentPath.includes('arabic-transcripts')) {
          return "Arabic";
        } else {
          return "Arabic"; // Global default
        }
      };

      if (currentVideo && currentPlaylist) {
        setSelectedPlaylistId(currentPlaylist.id.toString());
        setSelectedVideoId(currentVideo.id.toString());
        setTranslationLanguage(detectLanguage());
      } else {
        // If modal opens without current context, try to get from current URL params
        const urlParams = new URLSearchParams(window.location.search);
        const playlistIdFromUrl = urlParams.get('playlistId');
        const videoIdFromUrl = urlParams.get('videoId');
        
        if (playlistIdFromUrl) {
          setSelectedPlaylistId(playlistIdFromUrl);
        }
        if (videoIdFromUrl) {
          setSelectedVideoId(videoIdFromUrl);
        }
        
        setTranslationLanguage(detectLanguage());
      }
    }
  }, [isOpen, currentVideo, currentPlaylist]);

  const reportMutation = useMutation({
    mutationFn: async (data: {
      playlistId?: number;
      videoId?: number;
      segmentIndex?: number;
      description: string;
      contactName?: string;
      contactEmail?: string;
      contactMobile?: string;
    }) => {
      await apiRequest("POST", "/api/reported-issues", data);
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
    setTranslationLanguage("Arabic");
    setSegmentIndex("");
    setDescription("");
    setContactName("");
    setContactEmail("");
    setContactMobile("");
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
      description: `[${translationLanguage}] ${description.trim()}`, // Prefix with language
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactMobile: contactMobile.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Report Problem</DialogTitle>
          <DialogDescription>
            Help us improve by reporting any issues you encounter. All fields are optional except the description.
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 pr-2">
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
            <Label htmlFor="translationLanguage">Translation Language</Label>
            <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arabic">Arabic</SelectItem>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Urdu">Urdu</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="Turkish">Turkish</SelectItem>
                <SelectItem value="Malay">Malay</SelectItem>
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

          {/* Contact Information - Optional */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
              Contact Information (Optional)
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Name</Label>
                <Input
                  id="contactName"
                  placeholder="Your name (optional)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="your.email@example.com (optional)"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactMobile">Mobile Number</Label>
                <Input
                  id="contactMobile"
                  placeholder="+1 (555) 123-4567 (optional)"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                />
              </div>
            </div>
          </div>

            <DialogFooter className="mt-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}