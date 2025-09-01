import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Save, Clock, Plus, Trash2, Play, BookOpen, Edit, Upload, Minus, Type, Link, Download, Check, X } from "lucide-react";

interface TranscriptSegment {
  time: string;
  text: string;
}

// Declare YouTube iframe API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function parseSRTContent(content: any): TranscriptSegment[] {
  if (!content) return [];
  
  // Handle JSONB array content (stored segments)
  if (Array.isArray(content)) {
    return content.map(segment => ({
      time: segment.time || segment.timestamp || "0:00",
      text: segment.text || segment.content || ""
    }));
  }
  
  // Handle string content (SRT format)
  let contentStr = '';
  if (typeof content === 'string') {
    contentStr = content;
  } else if (typeof content === 'object' && content !== null) {
    contentStr = content.text || content.content || JSON.stringify(content);
  } else {
    contentStr = String(content);
  }
  
  const segments: TranscriptSegment[] = [];
  const blocks = contentStr.trim().split(/\n\s*\n/);
  
  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      // Support both formats:
      // 1. Standard: 00:01:23,000 --> 00:01:26,000
      // 2. Short: 78:48,015 --> 78:52,905
      const timeMatch = lines[1].match(/(\d{1,2}:\d{2}:\d{2},\d{3}|\d{1,3}:\d{2},\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2},\d{3}|\d{1,3}:\d{2},\d{3})/);
      if (timeMatch) {
        const startTime = timeMatch[1];
        const text = lines.slice(2).join('\n');
        segments.push({
          time: convertSrtToTime(startTime),
          text: text
        });
      }
    }
  });
  
  return segments;
}

// Convert SRT format to simple time format
function convertSrtToTime(srtTime: string): string {
  const timePart = srtTime.split(',')[0]; // Remove milliseconds
  const parts = timePart.split(':');
  
  if (parts.length === 3) {
    // Standard format: "00:01:23" -> "1:23" or "1:23:45"
    const [hours, minutes, seconds] = parts;
    if (hours === '00') {
      return `${parseInt(minutes)}:${seconds}`;
    }
    return `${parseInt(hours)}:${minutes}:${seconds}`;
  } else if (parts.length === 2) {
    // Short format: "78:48" -> "78:48"
    const [minutes, seconds] = parts;
    return `${parseInt(minutes)}:${seconds}`;
  }
  
  return timePart;
}

// Convert simple time format to SRT format (prioritize short format when minutes > 59)
function convertTimeToSrt(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    const minutesNum = parseInt(minutes);
    
    // If minutes > 59, use short format: "78:48,000"
    if (minutesNum > 59) {
      return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
    } else {
      // Use standard format: "00:01:23,000"
      return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
    }
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
  }
  return "00:00:00,000";
}

// Parse time-stamped format like "(0:02) text (0:22) more text"
function parseTimeStampedContent(content: string): TranscriptSegment[] {
  if (!content || typeof content !== 'string') return [];
  
  const segments: TranscriptSegment[] = [];
  // Match pattern: (time) text
  const regex = /\((\d+:\d+(?::\d+)?)\)\s*([^(]*?)(?=\(\d+:\d+(?::\d+)?\)|$)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const [, time, text] = match;
    const trimmedText = text.trim();
    if (trimmedText) {
      segments.push({
        time: time,
        text: trimmedText
      });
    }
  }
  
  return segments;
}

// Convert time-stamped format to SRT format
function convertTimeStampedToSRT(segments: TranscriptSegment[]): string {
  if (!segments || segments.length === 0) return "";
  
  let srtContent = "";
  segments.forEach((segment, index) => {
    const startTime = convertTimeToSrt(segment.time);
    // Calculate end time - use next segment's time or add 5 seconds if last segment
    let endTime = "00:00:05,000";
    if (index < segments.length - 1) {
      endTime = convertTimeToSrt(segments[index + 1].time);
    } else {
      // For last segment, add 5 seconds to start time
      const parts = segment.time.split(':');
      if (parts.length === 2) {
        const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]) + 5;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        endTime = convertTimeToSrt(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }
    
    srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
  });
  
  return srtContent.trim();
}

// Helper function to parse time string to seconds
function parseTimeToSeconds(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return parseInt(minutes) * 60 + parseFloat(seconds);
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
  }
  return 0;
}

export default function ArabicTranscriptsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Get language-specific approval status for Arabic
  const getApprovalStatus = (transcript: any): string => {
    return transcript?.approvalStatusAr || 'unchecked';
  };
  
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [arabicSegments, setArabicSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [srtTextContent, setSrtTextContent] = useState("");
  const [timeStampedContent, setTimeStampedContent] = useState("");
  const [viewMode, setViewMode] = useState<'segments' | 'text' | 'timestamped'>('segments');
  const [timeInputs, setTimeInputs] = useState<string[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastModifiedAt, setLastModifiedAt] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'draft' | 'published'>('draft');
  const [publishedSegments, setPublishedSegments] = useState<TranscriptSegment[]>([]);
  const [fontSize, setFontSize] = useState(16); // Font size in pixels
  const playerRef = useRef<HTMLDivElement>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  }) as { data: any };

  // Redirect if not authenticated or not admin/editor
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

    if (!isLoading && isAuthenticated && !['admin', 'arabic_transcripts_editor'].includes(currentUser?.role)) {
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

  // Fetch playlists
  const { data: playlists = [] } = useQuery<any[]>({
    queryKey: ["/api/playlists"],
    retry: false,
  });

  // Fetch videos for selected playlist
  const { data: playlistVideos = [] } = useQuery<any[]>({
    queryKey: ["/api/playlists", selectedPlaylistId, "videos"],
    enabled: !!selectedPlaylistId,
    retry: false,
  });

  // Handle URL parameter for video selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdParam = urlParams.get('videoId');
    
    if (videoIdParam && playlistVideos.length > 0) {
      const videoExists = playlistVideos.find(v => v.id.toString() === videoIdParam);
      if (videoExists) {
        setSelectedVideoId(videoIdParam);
      }
    }
  }, [playlistVideos]);

  // Fetch Arabic transcript for selected video
  const { data: transcripts = [] } = useQuery<any[]>({
    queryKey: ["/api/videos", selectedVideoId, "transcripts"],
    enabled: !!selectedVideoId,
    retry: false,
  });

  // Get selected video data
  const selectedVideo = playlistVideos.find(v => v.id.toString() === selectedVideoId);
  const arabicTranscript = transcripts.find(t => t.language === 'ar');

  // Initialize YouTube player
  useEffect(() => {
    if (!selectedVideo?.youtubeId) return;

    const initializeYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        // Destroy existing player if it exists
        if (player) {
          try {
            player.destroy();
          } catch (error) {
            console.log('Player cleanup error:', error);
          }
          setPlayer(null);
        }

        // Create new player
        const newPlayer = new window.YT.Player(playerRef.current, {
          videoId: selectedVideo.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              console.log('Player ready for:', selectedVideo.title);
              setPlayer(event.target);
            },
          },
        });
      }
    };

    // Load YouTube API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube iframe API ready');
        initializeYouTubeAPI();
      };
    } else {
      initializeYouTubeAPI();
    }

    return () => {
      if (player) {
        try {
          player.destroy();
        } catch (error) {
          console.log('Player cleanup error:', error);
        }
        setPlayer(null);
      }
    };
  }, [selectedVideo?.youtubeId]);

  // Load Arabic transcript when video or transcript changes
  useEffect(() => {
    // Load published content
    if (arabicTranscript?.content) {
      const publishedSegs = parseSRTContent(arabicTranscript.content);
      setPublishedSegments(publishedSegs);
    } else {
      setPublishedSegments([]);
    }

    // Load draft content if available, otherwise use published content
    if (arabicTranscript?.draftContent) {
      const segments = parseSRTContent(arabicTranscript.draftContent);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      updateSrtTextFromSegments(segments);
      updateTimeStampedFromSegments(segments);
      setHasDraftChanges(true);
    } else if (arabicTranscript?.content) {
      const segments = parseSRTContent(arabicTranscript.content);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      updateSrtTextFromSegments(segments);
      updateTimeStampedFromSegments(segments);
      setHasDraftChanges(false);
    } else {
      // Initialize with empty segment for new transcripts
      const emptySegments = [{ time: "0:00", text: "Click here to add your first Arabic transcript segment..." }];
      setArabicSegments(emptySegments);
      setTimeInputs(["0:00"]);
      updateSrtTextFromSegments(emptySegments);
      updateTimeStampedFromSegments(emptySegments);
      setHasDraftChanges(false);
    }
  }, [arabicTranscript]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasDraftChanges || saving || !selectedVideoId || !arabicTranscript) {
      return;
    }

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up auto-save interval (1 minute = 60,000ms)
    autoSaveIntervalRef.current = setInterval(() => {
      if (hasDraftChanges && !saving) {
        // Auto-save the current content
        if (viewMode === 'text') {
          const segments = parseSrtText(srtTextContent);
          saveDraft.mutate(segments);
        } else if (viewMode === 'timestamped') {
          const segments = parseTimeStampedContent(timeStampedContent);
          saveDraft.mutate(segments);
        } else {
          saveDraft.mutate(arabicSegments);
        }
      }
    }, 60000); // 1 minute

    // Cleanup interval on unmount or when dependencies change
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [hasDraftChanges, saving, selectedVideoId, arabicTranscript, autoSaveEnabled, viewMode, srtTextContent, arabicSegments]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);

  // Update time-stamped text when segments change (for timestamped mode)
  const updateTimeStampedFromSegments = (segments: TranscriptSegment[]) => {
    const timestampedText = segments.map(seg => `(${seg.time}) ${seg.text}`).join(' ');
    setTimeStampedContent(timestampedText);
  };

  // Update SRT text from segments
  const updateSrtTextFromSegments = (segments: TranscriptSegment[]) => {
    let srtText = "";
    segments.forEach((segment, index) => {
      if (segment.time && segment.text) {
        const startTime = convertTimeToSrt(segment.time);
        const endTime = index < segments.length - 1 
          ? convertTimeToSrt(segments[index + 1].time)
          : "00:00:10,000"; // Default 10 second duration for last segment
        
        srtText += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
      }
    });
    setSrtTextContent(srtText);
  };

  // Parse SRT text back to segments
  const parseSrtText = (srtText: string): TranscriptSegment[] => {
    const segments: TranscriptSegment[] = [];
    const blocks = srtText.trim().split(/\n\s*\n/);
    
    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          const startTime = timeMatch[1];
          const text = lines.slice(2).join('\n');
          segments.push({
            time: convertSrtToTime(startTime),
            text: text
          });
        }
      }
    });
    
    return segments;
  };

  // Parse time-stamped content back to segments
  const parseTimeStampedContent = (content: string): TranscriptSegment[] => {
    const segments: TranscriptSegment[] = [];
    
    // Match pattern: (time) text content
    const regex = /\(([^)]+)\)\s*([^(]*?)(?=\([^)]+\)|$)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const time = match[1].trim();
      const text = match[2].trim();
      
      if (time && text) {
        segments.push({ time, text });
      }
    }
    
    return segments.length > 0 ? segments : [{ time: "0:00", text: content || "Enter Arabic transcript text..." }];
  };

  // Save draft Arabic transcript
  const saveDraft = useMutation({
    mutationFn: async (segments: TranscriptSegment[]) => {
      if (arabicTranscript) {
        await apiRequest("PUT", `/api/transcripts/${arabicTranscript.id}/draft`, {
          content: segments,
        });
      } else {
        // Create new transcript with draft content
        const newTranscript = await apiRequest("POST", `/api/videos/${selectedVideoId}/transcripts`, {
          language: 'ar',
          content: [], // Empty published content
          draftContent: segments,
        });
        return newTranscript;
      }
    },
    onSuccess: () => {
      const now = new Date();
      setLastSavedAt(now);
      toast({
        title: "Draft Saved",
        description: "Arabic transcript draft saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideoId, "transcripts"] });
      setSaving(false);
      setHasDraftChanges(true);
    },
    onError: (error) => {
      setSaving(false);
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
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  // Publish Arabic transcript
  const publishTranscript = useMutation({
    mutationFn: async () => {
      if (!arabicTranscript) {
        throw new Error("No transcript found to publish");
      }
      await apiRequest("POST", `/api/transcripts/${arabicTranscript.id}/publish`, {});
    },
    onSuccess: () => {
      toast({
        title: "Published",
        description: "Arabic transcript published successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideoId, "transcripts"] });
      setPublishing(false);
      setHasDraftChanges(false);
    },
    onError: (error) => {
      setPublishing(false);
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
        description: error.message || "Failed to publish transcript",
        variant: "destructive",
      });
    },
  });

  // Update approval status
  const updateApprovalStatusMutation = useMutation({
    mutationFn: async ({ transcriptId, approvalStatus }: { transcriptId: number, approvalStatus: string }) => {
      return apiRequest('PUT', `/api/transcripts/${transcriptId}/approval-status`, {
        approvalStatus,
        language: 'ar'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideoId, "transcripts"] });
      toast({
        title: "Success",
        description: `Arabic transcript marked as ${updateApprovalStatusMutation.variables?.approvalStatus === 'approved' ? 'checked' : 'unchecked'}`,
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update approval status",
          variant: "destructive",
        });
      }
    },
  });

  const handleApprovalStatusUpdate = (approvalStatus: string) => {
    if (!arabicTranscript) return;
    
    updateApprovalStatusMutation.mutate({
      transcriptId: arabicTranscript.id,
      approvalStatus,
    });
  };

  const handleSaveDraft = () => {
    setSaving(true);
    if (viewMode === 'text') {
      // Parse SRT text back to segments
      const segments = parseSrtText(srtTextContent);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      saveDraft.mutate(segments);
    } else if (viewMode === 'timestamped') {
      // Parse time-stamped text back to segments
      const segments = parseTimeStampedContent(timeStampedContent);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      saveDraft.mutate(segments);
    } else {
      saveDraft.mutate(arabicSegments);
    }
  };

  const handlePublish = () => {
    setPublishing(true);
    publishTranscript.mutate();
  };

  const handleDownloadSrt = () => {
    if (!arabicSegments || arabicSegments.length === 0) {
      toast({
        title: "No Content",
        description: "No transcript content available to download.",
        variant: "destructive",
      });
      return;
    }

    // Generate SRT content
    let srtContent = "";
    arabicSegments.forEach((segment, index) => {
      if (segment.time && segment.text) {
        const startTime = convertTimeToSrt(segment.time);
        const endTime = index < arabicSegments.length - 1 
          ? convertTimeToSrt(arabicSegments[index + 1].time)
          : "00:00:10,000"; // Default 10 second duration for last segment
        
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
      }
    });

    // Create and download file
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedVideo 
      ? `${selectedVideo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_arabic.srt`
      : 'arabic_transcript.srt';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "SRT file downloaded successfully!",
    });
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
    const newSegments = [...arabicSegments];
    newSegments[index] = { ...newSegments[index], text: newText };
    setArabicSegments(newSegments);
    // Always update both SRT and timestamped views when segments change
    updateSrtTextFromSegments(newSegments);
    updateTimeStampedFromSegments(newSegments);
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  const handleTimeEdit = (index: number, newTime: string) => {
    const formattedTime = formatTimeInput(newTime);
    const newSegments = [...arabicSegments];
    newSegments[index] = { ...newSegments[index], time: formattedTime };
    setArabicSegments(newSegments);
    
    const newTimeInputs = [...timeInputs];
    newTimeInputs[index] = formattedTime;
    setTimeInputs(newTimeInputs);
    
    // Always update both SRT and timestamped views when segments change
    updateSrtTextFromSegments(newSegments);
    updateTimeStampedFromSegments(newSegments);
    
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  const formatTimeInput = (time: string): string => {
    const cleanTime = time.replace(/[^\d:]/g, '');
    
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanTime)) {
      return cleanTime;
    }
    
    const parts = cleanTime.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return `${minutes}:${seconds.padStart(2, '0')}`;
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }
    
    return time;
  };

  const addNewSegment = () => {
    const lastSegment = arabicSegments[arabicSegments.length - 1];
    const lastTime = lastSegment?.time || "0:00";
    const newTime = calculateNextTime(lastTime);
    
    const newSegment = { time: newTime, text: "" };
    const newSegments = [...arabicSegments, newSegment];
    setArabicSegments(newSegments);
    setTimeInputs([...timeInputs, newTime]);
    
    // Always update both SRT and timestamped views when segments change
    updateSrtTextFromSegments(newSegments);
    updateTimeStampedFromSegments(newSegments);
    
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  const addSegmentAfter = (index: number) => {
    const currentSegment = arabicSegments[index];
    const currentTime = currentSegment?.time || "0:00";
    const newTime = calculateNextTime(currentTime);
    
    const newSegment = { time: newTime, text: "" };
    const newSegments = [...arabicSegments];
    newSegments.splice(index + 1, 0, newSegment);
    setArabicSegments(newSegments);
    
    const newTimeInputs = [...timeInputs];
    newTimeInputs.splice(index + 1, 0, newTime);
    setTimeInputs(newTimeInputs);
    
    // Always update both SRT and timestamped views when segments change
    updateSrtTextFromSegments(newSegments);
    updateTimeStampedFromSegments(newSegments);
    
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  const calculateNextTime = (timeString: string): string => {
    const seconds = parseTimeToSeconds(timeString) + 10; // Add 10 seconds
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const deleteSegment = (index: number) => {
    if (arabicSegments.length > 1) {
      const newSegments = arabicSegments.filter((_, i) => i !== index);
      const newTimeInputs = timeInputs.filter((_, i) => i !== index);
      setArabicSegments(newSegments);
      setTimeInputs(newTimeInputs);
      
      // Always update both SRT and timestamped views when segments change
      updateSrtTextFromSegments(newSegments);
      updateTimeStampedFromSegments(newSegments);
      
      if (activeSegmentIndex >= newSegments.length) {
        setActiveSegmentIndex(Math.max(0, newSegments.length - 1));
      }
      
      // Mark as having unsaved changes and update modification time
      setHasDraftChanges(true);
      setLastModifiedAt(new Date());
    }
  };

  // Handle SRT text change
  const handleSrtTextChange = (newText: string) => {
    setSrtTextContent(newText);
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  // Handle time-stamped text change
  const handleTimeStampedChange = (newText: string) => {
    setTimeStampedContent(newText);
    // Mark as having unsaved changes and update modification time
    setHasDraftChanges(true);
    setLastModifiedAt(new Date());
  };

  // Generate custom URL for sharing
  const generateCustomUrl = () => {
    if (!selectedVideoId) {
      toast({
        title: "Error",
        description: "Please select a video first",
        variant: "destructive",
      });
      return;
    }

    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('videoId', selectedVideoId);
    
    const customUrl = `${baseUrl}/arabic-transcripts?${params.toString()}`;
    
    navigator.clipboard.writeText(customUrl).then(() => {
      toast({
        title: "Success",
        description: "Custom URL copied to clipboard!",
      });
    }).catch(() => {
      toast({
        title: "Error", 
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      });
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !['admin', 'arabic_transcripts_editor'].includes(currentUser?.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Arabic Transcripts</h1>
              </div>
              
              {selectedVideoId && (
                <Button
                  onClick={generateCustomUrl}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Link size={16} />
                  Copy Custom URL
                </Button>
              )}
            </div>
            <p className="text-gray-600">
              Create and edit Arabic transcripts with video playback and segment management.
            </p>
          </div>

          {/* Playlist and Video Selector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Select Playlist & Video</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Playlist Selector */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Playlist
                </label>
                <Select value={selectedPlaylistId} onValueChange={(value) => {
                  setSelectedPlaylistId(value);
                  setSelectedVideoId(""); // Reset video selection when playlist changes
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a playlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {playlists.map((playlist) => (
                      <SelectItem key={playlist.id} value={playlist.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{playlist.name}</span>
                          <span className="text-xs text-gray-500">
                            ({playlist.videoCount || playlist.videos?.length || 0} videos)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Video Selector */}
              {selectedPlaylistId && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Select Video
                  </label>
                  <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a video to edit Arabic transcript" />
                    </SelectTrigger>
                    <SelectContent>
                      {playlistVideos.map((video) => (
                        <SelectItem key={video.id} value={video.id.toString()}>
                          <div className="flex items-center space-x-3 py-1">
                            <img 
                              src={video.thumbnailUrl} 
                              alt={video.title}
                              className="w-12 h-9 rounded object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {video.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {video.duration}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedVideo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Player */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Video Player</span>
                    <Badge variant="outline">
                      {selectedVideo.duration}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <div ref={playerRef} className="w-full h-full" />
                  </div>
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-900 mb-2">{selectedVideo.title}</h3>
                    {selectedVideo.description && (
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {selectedVideo.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Arabic Transcript Editor */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Arabic Transcript</span>
                    </CardTitle>
                    
                    {/* Status and timestamps */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex flex-col text-xs text-gray-500">
                        {lastModifiedAt && (
                          <span>Modified: {lastModifiedAt.toLocaleTimeString()}</span>
                        )}
                        {lastSavedAt && (
                          <span>Saved: {lastSavedAt.toLocaleTimeString()}</span>
                        )}
                      </div>
                      
                      {/* Approval Status Badge and Controls */}
                      {arabicTranscript && (
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={getApprovalStatus(arabicTranscript) === 'approved' ? 'default' : 'destructive'}
                            className={`text-xs ${
                              getApprovalStatus(arabicTranscript) === 'approved' 
                                ? 'bg-green-100 text-green-800 border-green-300' 
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}
                          >
                            {getApprovalStatus(arabicTranscript) === 'approved' ? 'Checked' : 'Unchecked'}
                          </Badge>
                          
                          {currentUser?.role === 'admin' && (
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant={getApprovalStatus(arabicTranscript) === 'approved' ? 'default' : 'outline'}
                                onClick={() => handleApprovalStatusUpdate('approved')}
                                disabled={updateApprovalStatusMutation.isPending}
                                className="h-6 px-2 text-xs"
                              >
                                <Check size={12} className="mr-1" />
                                <span className="hidden sm:inline">Checked</span>
                              </Button>
                              <Button
                                size="sm"
                                variant={getApprovalStatus(arabicTranscript) === 'unchecked' ? 'destructive' : 'outline'}
                                onClick={() => handleApprovalStatusUpdate('unchecked')}
                                disabled={updateApprovalStatusMutation.isPending}
                                className="h-6 px-2 text-xs"
                              >
                                <X size={12} className="mr-1" />
                                <span className="hidden sm:inline">Unchecked</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {currentUser?.role === 'admin' && (
                        <Button 
                          onClick={handleDownloadSrt}
                          disabled={!arabicSegments || arabicSegments.length === 0}
                          size="sm"
                          variant="outline"
                          className="h-8"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Download SRT</span>
                          <span className="sm:hidden">SRT</span>
                        </Button>
                      )}
                      <Button 
                        onClick={handleSaveDraft}
                        disabled={saving}
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{saving ? "Saving..." : "Save Draft"}</span>
                        <span className="sm:hidden">{saving ? "..." : "Save"}</span>
                      </Button>
                      <Button 
                        onClick={handlePublish}
                        disabled={publishing || !hasDraftChanges}
                        size="sm"
                        className="h-8"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{publishing ? "Publishing..." : "Publish"}</span>
                        <span className="sm:hidden">{publishing ? "..." : "Pub"}</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'draft' | 'published')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="draft" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                        Draft Editor
                      </TabsTrigger>
                      <TabsTrigger value="published" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                        Published View
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="draft" className="mt-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <input
                                type="radio"
                                id="segments-mode"
                                name="view-mode"
                                checked={viewMode === 'segments'}
                                onChange={() => setViewMode('segments')}
                                className="w-4 h-4"
                              />
                              <label htmlFor="segments-mode" className="text-sm text-gray-600 cursor-pointer">
                                Segments
                              </label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <input
                                type="radio"
                                id="srt-mode"
                                name="view-mode"
                                checked={viewMode === 'text'}
                                onChange={() => setViewMode('text')}
                                className="w-4 h-4"
                              />
                              <label htmlFor="srt-mode" className="text-sm text-gray-600 cursor-pointer">
                                SRT Format
                              </label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <input
                                type="radio"
                                id="timestamped-mode"
                                name="view-mode"
                                checked={viewMode === 'timestamped'}
                                onChange={() => setViewMode('timestamped')}
                                className="w-4 h-4"
                              />
                              <label htmlFor="timestamped-mode" className="text-sm text-gray-600 cursor-pointer">
                                Time-Stamped
                              </label>
                            </div>
                          </div>
                          
                          {/* Font Size Controls */}
                          <div className="flex items-center space-x-2">
                            <Type size={16} className="text-gray-500" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                              className="h-8 w-8 p-0"
                            >
                              <Minus size={14} />
                            </Button>
                            <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                              {fontSize}px
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                              className="h-8 w-8 p-0"
                            >
                              <Plus size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                  {viewMode === 'segments' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            {arabicSegments.length} segments
                          </span>
                          {hasDraftChanges && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              Draft changes
                            </span>
                          )}
                          {autoSaveEnabled && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Auto-save: ON
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={addNewSegment}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Segment
                        </Button>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {arabicSegments.map((segment, index) => (
                          <div 
                            key={index} 
                            className={`border rounded-lg p-3 ${
                              activeSegmentIndex === index 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Input
                                  value={timeInputs[index] || segment.time}
                                  onChange={(e) => {
                                    const newTimeInputs = [...timeInputs];
                                    newTimeInputs[index] = e.target.value;
                                    setTimeInputs(newTimeInputs);
                                  }}
                                  onBlur={(e) => handleTimeEdit(index, e.target.value)}
                                  className="w-20 text-xs"
                                  placeholder="0:00"
                                />
                                <Button
                                  onClick={() => handleSegmentClick(index, segment.time)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Jump
                                </Button>
                                <Button
                                  onClick={() => addSegmentAfter(index)}
                                  size="sm"
                                  variant="outline"
                                  className="border-green-300 text-green-700 hover:bg-green-50"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              </div>
                              {arabicSegments.length > 1 && (
                                <Button
                                  onClick={() => deleteSegment(index)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <Textarea
                              value={segment.text}
                              onChange={(e) => handleTextEdit(index, e.target.value)}
                              placeholder="Enter Arabic transcript text..."
                              className="min-h-[80px] text-right direction-rtl arabic-font"
                              dir="rtl"
                              style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : viewMode === 'text' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex-1">
                          <p className="text-sm text-blue-800 flex items-start space-x-2">
                            <FileText size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>SRT Format View:</strong> Edit your Arabic transcript in standard SubRip (.srt) format. 
                              Each segment shows: sequence number, timestamp range, and text.
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {hasDraftChanges && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              Draft changes
                            </span>
                          )}
                          {autoSaveEnabled && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Auto-save: ON
                            </span>
                          )}
                        </div>
                      </div>
                      <Textarea
                        value={srtTextContent}
                        onChange={(e) => handleSrtTextChange(e.target.value)}
                        placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;مرحبا بكم في هذا الفيديو...&#10;&#10;2&#10;00:00:05,000 --> 00:00:08,000&#10;اليوم سوف نناقش الموضوع الرئيسي..."
                        className="min-h-[400px] text-right direction-rtl arabic-font"
                        dir="rtl"
                        style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                      />
                    </div>
                  ) : viewMode === 'timestamped' ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-blue-800 mb-2">Time-Stamped Format</h4>
                        <p className="text-sm text-blue-700 mb-2">
                          Enter text with timestamps in parentheses. Example:
                        </p>
                        <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900 block">
                          (0:02) ألف باء، تاء، ثاء، جيم (0:22) ألف أرنب يجري يلعب
                        </code>
                      </div>
                      <Textarea
                        value={timeStampedContent}
                        onChange={(e) => handleTimeStampedChange(e.target.value)}
                        placeholder="Enter time-stamped format content here...&#10;Example: (0:02) ألف باء، تاء، ثاء، جيم، حاء، خاء (0:22) ألف أرنب يجري يلعب يأكل جزرا"
                        className="min-h-[400px] text-right direction-rtl arabic-font"
                        dir="rtl"
                        style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                      />
                    </div>
                  ) : null}
                    </TabsContent>

                    <TabsContent value="published" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            {publishedSegments.length} published segments
                          </span>
                          <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Live Content
                          </div>
                        </div>
                        
                        {publishedSegments.length > 0 ? (
                          <div className="max-h-96 overflow-y-auto space-y-3">
                            {publishedSegments.map((segment, index) => (
                              <div 
                                key={index} 
                                className="border border-green-200 rounded-lg p-3 bg-green-50"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-mono">
                                      {segment.time}
                                    </span>
                                    <Button
                                      onClick={() => handleSegmentClick(index, segment.time)}
                                      size="sm"
                                      variant="outline"
                                      className="border-green-300 text-green-700 hover:bg-green-100"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      Jump
                                    </Button>
                                  </div>
                                </div>
                                <div 
                                  className="bg-white border border-green-200 rounded p-3 text-right direction-rtl arabic-font" 
                                  dir="rtl"
                                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                                >
                                  {segment.text || <span className="text-gray-400 italic">No content</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No Published Content</p>
                            <p className="text-sm">Create a draft and publish it to see content here.</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}

          {!selectedVideo && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Video</h3>
                  <p className="text-gray-600">
                    Choose a video from the dropdown above to start editing its Arabic transcript.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}