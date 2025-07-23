import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Save, Upload, FileText, Clock, Trash2, Plus, Edit, AlignLeft, X, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

interface TranscriptSegment {
  time: string;
  text: string;
}

interface TranscriptEditorProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
}

// Declare YouTube iframe API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function TranscriptEditor({ video, isOpen, onClose }: TranscriptEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState("ar");

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  }) as { data: any };

  // Check if user can edit transcripts (admin or editor)
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [srtContent, setSrtContent] = useState("");
  const [showSrtImport, setShowSrtImport] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [isOpenTextView, setIsOpenTextView] = useState(false);
  const [openTextContent, setOpenTextContent] = useState("");
  const [timeInputs, setTimeInputs] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isEditingLanguages, setIsEditingLanguages] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");
  const [vocabulary, setVocabulary] = useState("");
  const playerRef = useRef<HTMLDivElement>(null);

  const { data: transcripts } = useQuery({
    queryKey: ["/api/videos", video?.id, "transcripts"],
    enabled: isOpen && !!video?.id,
  });

  const { data: playlists } = useQuery({
    queryKey: ["/api/playlists"],
    enabled: isOpen && canEdit,
  });

  // Initialize YouTube iframe API
  useEffect(() => {
    if (!isOpen || !video?.youtubeId) return;

    const initializeYouTubeAPI = () => {
      // Load YouTube iframe API if not already loaded
      if (!window.YT) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);

        window.onYouTubeIframeAPIReady = () => {
          console.log('YouTube iframe API ready');
          createPlayer();
        };
      } else if (window.YT.loaded) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
      }
    };

    const createPlayer = () => {
      if (playerRef.current && video?.youtubeId) {
        const newPlayer = new window.YT.Player(playerRef.current, {
          videoId: video.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              console.log('Player ready for:', video.title);
              setPlayer(event.target);
            },
          },
        });
      }
    };

    // Small delay to ensure modal is fully rendered
    const timer = setTimeout(initializeYouTubeAPI, 100);
    return () => clearTimeout(timer);
  }, [isOpen, video?.youtubeId, video?.title]);

  // Cleanup player when modal closes
  useEffect(() => {
    if (!isOpen && player) {
      try {
        player.destroy();
      } catch (error) {
        console.log('Player cleanup error:', error);
      }
      setPlayer(null);
    }
  }, [isOpen, player]);

  // Initialize video URL and other data when video changes
  useEffect(() => {
    if (video?.youtubeId) {
      setVideoUrl(`https://www.youtube.com/watch?v=${video.youtubeId}`);
    }
    if (video?.playlistId) {
      setSelectedPlaylistId(video.playlistId);
    } else {
      setSelectedPlaylistId(null);
    }
    if (video?.vocabulary) {
      setVocabulary(video.vocabulary);
    } else {
      setVocabulary("");
    }
  }, [video?.youtubeId, video?.playlistId, video?.vocabulary]);

  // Initialize selected languages when transcripts change
  useEffect(() => {
    if (transcripts && Array.isArray(transcripts)) {
      const languages = transcripts.map((t: any) => t.language);
      setSelectedLanguages(languages);
    }
  }, [transcripts]);

  useEffect(() => {
    if (transcripts && Array.isArray(transcripts) && transcripts.length > 0) {
      const transcript = transcripts.find((t: any) => t.language === selectedLanguage);
      if (transcript && transcript.content) {
        const content = Array.isArray(transcript.content) ? transcript.content : [];
        setSegments(content);
        setTimeInputs(content.map((seg: any) => seg.time));
        updateOpenTextFromSegments(content);
      } else {
        // Create empty transcript structure
        const emptySegments = [
          { time: "0:00", text: "Click here to add your first transcript segment..." },
        ];
        setSegments(emptySegments);
        setTimeInputs(["0:00"]);
        updateOpenTextFromSegments(emptySegments);
      }
    }
  }, [transcripts, selectedLanguage]);

  // Update SRT format only when SRT view is toggled (not on every segment change)
  useEffect(() => {
    if (segments.length > 0 && isOpenTextView) {
      updateOpenTextFromSegments(segments);
    }
  }, [isOpenTextView]);

  const updateTranscriptMutation = useMutation({
    mutationFn: async (content: TranscriptSegment[]) => {
      const transcript = Array.isArray(transcripts) ? transcripts.find((t: any) => t.language === selectedLanguage) : null;
      if (transcript) {
        await apiRequest("PUT", `/api/transcripts/${transcript.id}`, {
          content,
        });
      } else {
        await apiRequest("POST", `/api/videos/${video.id}/transcripts`, {
          language: selectedLanguage,
          content,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transcript saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", video?.id, "transcripts"] });
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
        description: error.message || "Failed to save transcript",
        variant: "destructive",
      });
    },
  });

  const importSrtMutation = useMutation({
    mutationFn: async (srtContent: string) => {
      const transcript = Array.isArray(transcripts) ? transcripts.find((t: any) => t.language === selectedLanguage) : null;
      if (!transcript) {
        throw new Error("No transcript found for the selected language. Create a transcript first.");
      }
      await apiRequest("POST", `/api/transcripts/${transcript.id}/import-srt`, {
        srtContent,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `SRT file imported successfully! ${data.segmentsCount} segments added.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", video?.id, "transcripts"] });
      setSrtContent("");
      setShowSrtImport(false);
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
        description: error.message || "Failed to import SRT file",
        variant: "destructive",
      });
    },
  });

  // Helper function to extract YouTube ID from URL
  const extractYouTubeId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const updateVideoUrlMutation = useMutation({
    mutationFn: async (newUrl: string) => {
      const youtubeId = extractYouTubeId(newUrl);
      if (!youtubeId) {
        throw new Error("Invalid YouTube URL. Please enter a valid YouTube video URL.");
      }
      await apiRequest("PUT", `/api/videos/${video.id}`, {
        youtubeId,
      });
      return youtubeId;
    },
    onSuccess: (newYoutubeId) => {
      toast({
        title: "Success",
        description: "Video URL updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", video?.id, "transcripts"] });
      setIsEditingUrl(false);
      // Update the video object to reflect changes
      if (video) {
        video.youtubeId = newYoutubeId;
      }
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
        description: error.message || "Failed to update video URL",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateTranscriptMutation.mutate(segments);
  };

  const handleUpdateVideoUrl = () => {
    if (videoUrl.trim()) {
      updateVideoUrlMutation.mutate(videoUrl);
    }
  };

  const handleCancelUrlEdit = () => {
    setVideoUrl(`https://www.youtube.com/watch?v=${video.youtubeId}`);
    setIsEditingUrl(false);
  };

  const updatePlaylistMutation = useMutation({
    mutationFn: async (playlistId: number | null) => {
      await apiRequest("PUT", `/api/videos/${video.id}`, {
        playlistId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Video playlist updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setIsEditingPlaylist(false);
      // Update video object to reflect changes
      if (video) {
        video.playlistId = selectedPlaylistId;
      }
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

  const updateLanguagesMutation = useMutation({
    mutationFn: async (languages: string[]) => {
      // Add new languages (create new transcripts)
      const currentLanguages = Array.isArray(transcripts) ? transcripts.map((t: any) => t.language) : [];
      const languagesToAdd = languages.filter((lang: string) => !currentLanguages.includes(lang));
      const languagesToRemove = currentLanguages.filter((lang: string) => !languages.includes(lang));

      // Create new transcripts for added languages
      for (const language of languagesToAdd) {
        await apiRequest("POST", `/api/videos/${video.id}/transcripts`, {
          language,
          content: [],
        });
      }

      // Delete transcripts for removed languages (admin only)
      if (currentUser?.role === 'admin') {
        for (const language of languagesToRemove) {
          const transcript = Array.isArray(transcripts) ? transcripts.find((t: any) => t.language === language) : null;
          if (transcript) {
            await apiRequest("DELETE", `/api/transcripts/${transcript.id}`);
          }
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Available languages updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", video?.id, "transcripts"] });
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
        description: error.message || "Failed to update languages",
        variant: "destructive",
      });
    },
  });

  const handleUpdatePlaylist = () => {
    updatePlaylistMutation.mutate(selectedPlaylistId);
  };

  const handleCancelPlaylistEdit = () => {
    setSelectedPlaylistId(video?.playlistId || null);
    setIsEditingPlaylist(false);
  };

  const handleUpdateLanguages = () => {
    updateLanguagesMutation.mutate(selectedLanguages);
  };

  const handleCancelLanguagesEdit = () => {
    if (transcripts && Array.isArray(transcripts)) {
      const languages = transcripts.map((t: any) => t.language);
      setSelectedLanguages(languages);
    }
    setIsEditingLanguages(false);
  };

  const updateVocabularyMutation = useMutation({
    mutationFn: async (vocabularyText: string) => {
      await apiRequest("PUT", `/api/videos/${video.id}`, {
        vocabulary: vocabularyText,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vocabulary updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      // Update video object to reflect changes
      if (video) {
        video.vocabulary = vocabulary;
      }
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
        description: error.message || "Failed to update vocabulary",
        variant: "destructive",
      });
    },
  });

  const handleSaveVocabulary = () => {
    updateVocabularyMutation.mutate(vocabulary);
  };

  const handleImportSrt = () => {
    if (!srtContent.trim()) {
      toast({
        title: "Error",
        description: "Please paste SRT content first",
        variant: "destructive",
      });
      return;
    }
    importSrtMutation.mutate(srtContent);
  };

  // Helper function to parse time string to seconds
  const parseTimeToSeconds = (timeString: string): number => {
    const parts = timeString.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return parseInt(minutes) * 60 + parseFloat(seconds);
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
    }
    return 0;
  };

  const handleSegmentClick = (index: number, time: string) => {
    setActiveSegmentIndex(index);
    
    if (player && typeof player.seekTo === 'function') {
      const seconds = parseTimeToSeconds(time);
      player.seekTo(seconds, true);
      toast({
        description: `Jumped to ${time}`,
      });
    } else {
      toast({
        description: "Player not ready. Please wait for the video to load.",
        variant: "destructive",
      });
    }
  };

  const handleTextEdit = (index: number, newText: string) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], text: newText };
    setSegments(newSegments);
  };

  const handleTimeInputChange = (index: number, newTime: string) => {
    const newTimeInputs = [...timeInputs];
    newTimeInputs[index] = newTime;
    setTimeInputs(newTimeInputs);
  };

  const handleTimeEdit = (index: number, newTime: string) => {
    // Format the time input (allow formats like 1:23, 01:23, 1:23:45)
    const formattedTime = formatTimeInput(newTime);
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], time: formattedTime };
    setSegments(newSegments);
    
    // Update the time inputs state to match
    const newTimeInputs = [...timeInputs];
    newTimeInputs[index] = formattedTime;
    setTimeInputs(newTimeInputs);
  };

  const formatTimeInput = (time: string): string => {
    // Remove any non-digit and non-colon characters
    const cleanTime = time.replace(/[^\d:]/g, '');
    
    // If it's already in a good format, return it
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanTime)) {
      return cleanTime;
    }
    
    // Try to parse and format common inputs
    const parts = cleanTime.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return `${minutes}:${seconds.padStart(2, '0')}`;
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }
    
    return time; // Return original if can't format
  };

  const addNewSegment = (insertIndex?: number) => {
    const newSegments = [...segments];
    const newSegment = {
      time: "0:00",
      text: "New transcript segment...",
    };
    
    const newTimeInputs = [...timeInputs];
    
    if (insertIndex !== undefined) {
      newSegments.splice(insertIndex + 1, 0, newSegment);
      newTimeInputs.splice(insertIndex + 1, 0, "0:00");
    } else {
      newSegments.push(newSegment);
      newTimeInputs.push("0:00");
    }
    
    setSegments(newSegments);
    setTimeInputs(newTimeInputs);
    updateOpenTextFromSegments(newSegments);
  };

  const deleteSegment = (index: number) => {
    if (segments.length <= 1) {
      toast({
        description: "Cannot delete the last segment",
        variant: "destructive",
      });
      return;
    }
    
    const newSegments = segments.filter((_, i) => i !== index);
    const newTimeInputs = timeInputs.filter((_, i) => i !== index);
    setSegments(newSegments);
    setTimeInputs(newTimeInputs);
    updateOpenTextFromSegments(newSegments);
    
    // Adjust active segment index if needed
    if (activeSegmentIndex >= newSegments.length) {
      setActiveSegmentIndex(Math.max(0, newSegments.length - 1));
    }
  };

  const updateOpenTextFromSegments = (segs: TranscriptSegment[]) => {
    // Convert segments to SRT format
    const srtContent = segs.map((seg: TranscriptSegment, index: number) => {
      const startTime = convertTimeToSrt(seg.time);
      // Calculate end time (start time + default duration, or use next segment's start time)
      const nextSeg = segs[index + 1];
      let endTime: string;
      
      if (nextSeg) {
        // Use next segment's start time as this segment's end time
        const nextStartSeconds = parseTimeToSeconds(nextSeg.time);
        const currentStartSeconds = parseTimeToSeconds(seg.time);
        
        // Ensure minimum 1 second duration and don't overlap
        if (nextStartSeconds > currentStartSeconds) {
          endTime = convertTimeToSrt(nextSeg.time);
        } else {
          // If times are wrong, add 3 seconds
          endTime = convertSecondsToSrt(currentStartSeconds + 3);
        }
      } else {
        // For the last segment, add 4 seconds duration
        const startSeconds = parseTimeToSeconds(seg.time);
        endTime = convertSecondsToSrt(startSeconds + 4);
      }
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}`;
    }).join('\n\n');
    setOpenTextContent(srtContent);
  };

  const convertTimeToSrt = (time: string): string => {
    // Convert "1:23" format to "00:01:23,000" SRT format
    const parts = time.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
    }
    return "00:00:00,000";
  };

  const convertSrtToTime = (srtTime: string): string => {
    // Convert "00:01:23,000" SRT format to "1:23" format
    const timePart = srtTime.split(',')[0]; // Remove milliseconds
    const [hours, minutes, seconds] = timePart.split(':');
    
    // If hours is 00, return minutes:seconds format
    if (hours === '00') {
      return `${parseInt(minutes)}:${seconds}`;
    }
    return `${parseInt(hours)}:${minutes}:${seconds}`;
  };

  const convertSecondsToSrt = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')},000`;
  };

  const updateSegmentsFromOpenText = (text: string) => {
    // Parse SRT format
    const srtBlocks = text.split('\n\n').filter(block => block.trim());
    
    if (srtBlocks.length === 0) {
      setSegments([{ time: "0:00", text: "Empty transcript..." }]);
      return;
    }
    
    const newSegments: TranscriptSegment[] = [];
    
    for (const block of srtBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        // Standard SRT format: sequence number, timestamp, text
        const sequenceNum = lines[0];
        const timeLine = lines[1];
        const textLines = lines.slice(2);
        
        // Parse the timestamp line (e.g., "00:01:23,000 --> 00:01:26,000")
        const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/);
        if (timeMatch) {
          const startTime = convertSrtToTime(timeMatch[1]);
          const text = textLines.join('\n');
          newSegments.push({ time: startTime, text });
        }
      } else if (lines.length === 1) {
        // Simple text line - use existing timestamp or default
        newSegments.push({
          time: segments[newSegments.length]?.time || "0:00",
          text: lines[0],
        });
      }
    }
    
    if (newSegments.length === 0) {
      setSegments([{ time: "0:00", text: "Empty transcript..." }]);
    } else {
      setSegments(newSegments);
    }
  };

  const handleOpenTextChange = (text: string) => {
    setOpenTextContent(text);
    updateSegmentsFromOpenText(text);
  };

  const languageOptions = [
    { code: "en", name: "English" },
    { code: "ar", name: "Arabic" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
  ];

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden" hideCloseButton>
        <DialogHeader className="px-6 py-4 border-b relative flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Edit Transcript - {video.title}
            </DialogTitle>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-muted-foreground">Language:</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-32 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((lang) => (
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
                  window.open(`/?playlist=${video.playlistId}&video=${video.id}`, '_blank');
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

        <div className="flex h-[calc(90vh-120px)] overflow-hidden">
          {/* Video Player */}
          <div className="w-1/2 p-6 border-r flex flex-col">
            <div className="aspect-video bg-slate-900 rounded-lg mb-4 relative overflow-hidden flex-shrink-0">
              <div
                ref={playerRef}
                className="w-full h-full"
              />
            </div>

            {/* Video Info - Scrollable */}
            <div className="text-sm text-muted-foreground space-y-3 overflow-y-auto flex-1 pr-2">
              <p className="font-medium">{video.title}</p>
              <p>Duration: {video.duration}</p>
              
              {/* Video URL Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Video URL:</label>
                  {canEdit && !isEditingUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingUrl(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit size={12} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingUrl ? (
                  <div className="space-y-2">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-xs border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg px-3 py-2 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                      disabled={updateVideoUrlMutation.isPending}
                    />
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateVideoUrl}
                        disabled={updateVideoUrlMutation.isPending}
                        className="h-6 px-2 text-xs"
                      >
                        {updateVideoUrlMutation.isPending ? "Updating..." : "Update"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelUrlEdit}
                        disabled={updateVideoUrlMutation.isPending}
                        className="h-6 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs break-all font-mono bg-muted p-2 rounded">
                    {videoUrl}
                  </p>
                )}
              </div>

              {/* Playlist Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Playlist:</label>
                  {canEdit && !isEditingPlaylist && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPlaylist(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit size={12} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingPlaylist ? (
                  <div className="space-y-2">
                    <Select 
                      value={selectedPlaylistId?.toString() || ""} 
                      onValueChange={(value) => setSelectedPlaylistId(value ? parseInt(value) : null)}
                    >
                      <SelectTrigger className="text-xs border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
                        <SelectValue placeholder="Select a playlist" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Playlist</SelectItem>
                        {Array.isArray(playlists) && playlists.map((playlist: any) => (
                          <SelectItem key={playlist.id} value={playlist.id.toString()}>
                            {playlist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleUpdatePlaylist}
                        disabled={updatePlaylistMutation.isPending}
                        className="h-6 px-2 text-xs"
                      >
                        {updatePlaylistMutation.isPending ? "Updating..." : "Update"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelPlaylistEdit}
                        disabled={updatePlaylistMutation.isPending}
                        className="h-6 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs bg-muted p-2 rounded">
                    {video.playlist?.name || "No Playlist"}
                  </p>
                )}
              </div>

              {/* Available Languages Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Available Languages:</label>
                  {canEdit && !isEditingLanguages && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingLanguages(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit size={12} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingLanguages ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {languageOptions.map((lang) => (
                        <div key={lang.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`lang-${lang.code}`}
                            checked={selectedLanguages.includes(lang.code)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLanguages([...selectedLanguages, lang.code]);
                              } else {
                                setSelectedLanguages(selectedLanguages.filter(l => l !== lang.code));
                              }
                            }}
                          />
                          <label htmlFor={`lang-${lang.code}`} className="text-xs">
                            {lang.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateLanguages}
                        disabled={updateLanguagesMutation.isPending || selectedLanguages.length === 0}
                        className="h-6 px-2 text-xs"
                      >
                        {updateLanguagesMutation.isPending ? "Updating..." : "Update"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelLanguagesEdit}
                        disabled={updateLanguagesMutation.isPending}
                        className="h-6 px-2 text-xs"
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
                  <div className="text-xs bg-muted p-2 rounded">
                    {selectedLanguages.length > 0 
                      ? selectedLanguages.map(code => 
                          languageOptions.find(l => l.code === code)?.name
                        ).join(', ')
                      : "No languages available"
                    }
                  </div>
                )}
              </div>
              
              <p className="mt-2 text-xs">
                Use the YouTube player controls above to play, pause, and seek through the video. 
                Click on transcript segments to note timing for synchronization.
              </p>
            </div>
          </div>

          {/* Tabbed Editor */}
          <div className="w-1/2 p-6 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
              </TabsList>
              
              {/* Transcript Tab */}
              <TabsContent value="transcript" className="flex-1 flex flex-col mt-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h4 className="font-medium text-foreground">Transcript Editor</h4>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="text-view"
                        checked={isOpenTextView}
                        onCheckedChange={setIsOpenTextView}
                      />
                      <label htmlFor="text-view" className="text-sm text-muted-foreground cursor-pointer">
                        <FileText size={14} className="inline mr-1" />
                        SRT Format
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                {canEdit && (
                  <Popover open={showSrtImport} onOpenChange={setShowSrtImport}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload size={16} className="mr-1" />
                        Import SRT
                      </Button>
                    </PopoverTrigger>
                  <PopoverContent className="w-96 p-4">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <FileText size={16} className="text-muted-foreground" />
                        <h5 className="font-medium">Import SRT File</h5>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Paste your SRT subtitle content below. It will be converted to timed transcript segments.
                      </p>
                      <Textarea
                        placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Hello and welcome to this video...&#10;&#10;2&#10;00:00:05,000 --> 00:00:08,000&#10;Today we will be discussing..."
                        value={srtContent}
                        onChange={(e) => setSrtContent(e.target.value)}
                        rows={8}
                        className="resize-none border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600 font-mono text-sm"
                      />
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          onClick={handleImportSrt}
                          disabled={importSrtMutation.isPending || !srtContent.trim()}
                          className="flex-1"
                        >
                          <Upload size={14} className="mr-1" />
                          {importSrtMutation.isPending ? "Importing..." : "Import SRT"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setSrtContent("");
                            setShowSrtImport(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    </PopoverContent>
                  </Popover>
                )}
                
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => addNewSegment()}>
                      <Plus size={16} className="mr-1" />
                      Add Segment
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSave}
                      disabled={updateTranscriptMutation.isPending}
                    >
                      <Save size={16} className="mr-1" />
                      {updateTranscriptMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
                
                {!canEdit && (
                  <div className="text-sm text-muted-foreground px-3 py-2 bg-gray-100 rounded-lg">
                    View Only - Contact admin for editing permissions
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isOpenTextView ? (
                <div className="h-full">
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 flex items-start space-x-2">
                      <FileText size={16} className="mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>SRT Format View:</strong> Edit your transcript in standard SubRip (.srt) format. 
                        Each segment shows: sequence number, timestamp range, and text. Modify timestamps and text directly.
                      </span>
                    </p>
                  </div>
                  <Textarea
                    value={openTextContent}
                    onChange={canEdit ? (e) => handleOpenTextChange(e.target.value) : undefined}
                    placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Welcome to this video transcript...&#10;&#10;2&#10;00:00:05,000 --> 00:00:08,000&#10;Today we will be discussing the main topic...&#10;&#10;3&#10;00:00:09,000 --> 00:00:12,000&#10;Each segment shows timing and text content..."
                    className={`resize-none h-full min-h-[400px] font-mono text-sm border-2 transition-all duration-200 rounded-lg ${
                      selectedLanguage === 'ar' ? 'text-right direction-rtl' : 'text-left direction-ltr'
                    } ${!canEdit 
                      ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                      : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    readOnly={!canEdit}
                    dir={selectedLanguage === 'ar' ? 'rtl' : 'ltr'}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {segments.length > 0 ? (
                    segments.map((segment, index) => (
                      <div
                        key={index}
                        className={`flex space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors ${
                          index === activeSegmentIndex ? "bg-blue-50 border-l-4 border-primary" : ""
                        }`}
                      >
                        <div className="flex flex-col space-y-2 w-20 flex-shrink-0">
                          <div className="flex items-center space-x-1">
                            <Clock size={12} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Time</span>
                          </div>
                          <Input
                            value={timeInputs[index] || segment.time}
                            onChange={canEdit ? (e) => handleTimeInputChange(index, e.target.value) : undefined}
                            onBlur={canEdit ? (e) => handleTimeEdit(index, e.target.value) : undefined}
                            onFocus={canEdit ? (e) => e.target.select() : undefined}
                            className={`text-xs h-8 text-center font-mono border-2 rounded-lg transition-all duration-200 ${
                              !canEdit 
                                ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            placeholder="0:00"
                            readOnly={!canEdit}
                          />
                          <button
                            onClick={() => handleSegmentClick(index, segment.time)}
                            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Jump to
                          </button>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Transcript Text</span>
                            {canEdit && (
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addNewSegment(index)}
                                  className="h-6 px-2"
                                >
                                  <Plus size={12} className="text-green-600" />
                                </Button>
                                {segments.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteSegment(index)}
                                    className="h-6 px-2"
                                  >
                                    <Trash2 size={12} className="text-red-600" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <Textarea
                            value={segment.text}
                            onChange={canEdit ? (e) => handleTextEdit(index, e.target.value) : undefined}
                            onBlur={() => updateOpenTextFromSegments(segments)}
                            className={`text-sm min-h-[60px] resize-none border-2 rounded-lg transition-all duration-200 ${
                              selectedLanguage === 'ar' ? 'text-right direction-rtl' : 'text-left direction-ltr'
                            } ${!canEdit 
                              ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                              : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            placeholder="Enter transcript text here..."
                            readOnly={!canEdit}
                            dir={selectedLanguage === 'ar' ? 'rtl' : 'ltr'}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No transcript segments yet.</p>
                      {canEdit && (
                        <Button className="mt-4" onClick={() => addNewSegment()}>
                          Add First Segment
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            </TabsContent>
            
            {/* Vocabulary Tab */}
            <TabsContent value="vocabulary" className="flex-1 flex flex-col mt-0">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-foreground">Vocabulary Notes</h4>
                {canEdit && (
                  <Button 
                    onClick={handleSaveVocabulary}
                    disabled={updateVocabularyMutation.isPending}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Save size={16} />
                    <span>{updateVocabularyMutation.isPending ? "Saving..." : "Save"}</span>
                  </Button>
                )}
              </div>
              
              <div className="flex-1">
                <Textarea
                  value={vocabulary}
                  onChange={canEdit ? (e) => setVocabulary(e.target.value) : undefined}
                  className={`w-full h-full min-h-[400px] resize-none border-2 rounded-lg transition-all duration-200 ${
                    !canEdit 
                      ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                      : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  placeholder={canEdit ? "Add vocabulary notes, word definitions, and explanations here..." : "No vocabulary notes available"}
                  readOnly={!canEdit}
                />
              </div>
            </TabsContent>
            
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
