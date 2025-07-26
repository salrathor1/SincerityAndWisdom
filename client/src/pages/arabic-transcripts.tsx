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
import { FileText, Save, Clock, Plus, Trash2, Play, BookOpen, Edit } from "lucide-react";

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
}

// Convert "00:01:23,000" SRT format to "1:23" format
function convertSrtToTime(srtTime: string): string {
  const timePart = srtTime.split(',')[0]; // Remove milliseconds
  const [hours, minutes, seconds] = timePart.split(':');
  
  // If hours is 00, return minutes:seconds format
  if (hours === '00') {
    return `${parseInt(minutes)}:${seconds}`;
  }
  return `${parseInt(hours)}:${minutes}:${seconds}`;
}

// Convert "1:23" format to "00:01:23,000" SRT format
function convertTimeToSrt(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
  }
  return "00:00:00,000";
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
  
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [arabicSegments, setArabicSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [srtTextContent, setSrtTextContent] = useState("");
  const [viewMode, setViewMode] = useState<'segments' | 'text'>('segments');
  const [timeInputs, setTimeInputs] = useState<string[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);

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

    if (!isLoading && isAuthenticated && !['admin', 'editor'].includes(currentUser?.role)) {
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

  // Fetch videos
  const { data: videos = [] } = useQuery<any[]>({
    queryKey: ["/api/videos"],
    retry: false,
  });

  // Fetch Arabic transcript for selected video
  const { data: transcripts = [] } = useQuery<any[]>({
    queryKey: ["/api/videos", selectedVideoId, "transcripts"],
    enabled: !!selectedVideoId,
    retry: false,
  });

  // Get selected video data
  const selectedVideo = videos.find(v => v.id.toString() === selectedVideoId);
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
    if (arabicTranscript?.content) {
      const segments = parseSRTContent(arabicTranscript.content);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      updateSrtTextFromSegments(segments);
    } else {
      // Initialize with empty segment for new transcripts
      const emptySegments = [{ time: "0:00", text: "Click here to add your first Arabic transcript segment..." }];
      setArabicSegments(emptySegments);
      setTimeInputs(["0:00"]);
      updateSrtTextFromSegments(emptySegments);
    }
  }, [arabicTranscript]);

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

  // Save Arabic transcript
  const saveTranscript = useMutation({
    mutationFn: async (segments: TranscriptSegment[]) => {
      if (arabicTranscript) {
        await apiRequest("PUT", `/api/transcripts/${arabicTranscript.id}`, {
          content: segments,
        });
      } else {
        await apiRequest("POST", `/api/videos/${selectedVideoId}/transcripts`, {
          language: 'ar',
          content: segments,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Arabic transcript saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideoId, "transcripts"] });
      setSaving(false);
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
        description: error.message || "Failed to save Arabic transcript",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    setSaving(true);
    if (viewMode === 'text') {
      // Parse SRT text back to segments
      const segments = parseSrtText(srtTextContent);
      setArabicSegments(segments);
      setTimeInputs(segments.map(seg => seg.time));
      saveTranscript.mutate(segments);
    } else {
      saveTranscript.mutate(arabicSegments);
    }
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
    if (viewMode === 'segments') {
      updateSrtTextFromSegments(newSegments);
    }
  };

  const handleTimeEdit = (index: number, newTime: string) => {
    const formattedTime = formatTimeInput(newTime);
    const newSegments = [...arabicSegments];
    newSegments[index] = { ...newSegments[index], time: formattedTime };
    setArabicSegments(newSegments);
    
    const newTimeInputs = [...timeInputs];
    newTimeInputs[index] = formattedTime;
    setTimeInputs(newTimeInputs);
    
    if (viewMode === 'segments') {
      updateSrtTextFromSegments(newSegments);
    }
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
    
    if (viewMode === 'segments') {
      updateSrtTextFromSegments(newSegments);
    }
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
      
      if (viewMode === 'segments') {
        updateSrtTextFromSegments(newSegments);
      }
      
      if (activeSegmentIndex >= newSegments.length) {
        setActiveSegmentIndex(Math.max(0, newSegments.length - 1));
      }
    }
  };

  // Handle SRT text change
  const handleSrtTextChange = (newText: string) => {
    setSrtTextContent(newText);
    // Don't auto-update segments while typing, wait for save
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !['admin', 'editor'].includes(currentUser?.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <BookOpen className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Arabic Transcripts</h1>
            </div>
            <p className="text-gray-600">
              Create and edit Arabic transcripts with video playback and segment management.
            </p>
          </div>

          {/* Video Selector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Select Video</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a video to edit Arabic transcript" />
                </SelectTrigger>
                <SelectContent>
                  {videos.map((video) => (
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
            </CardContent>
          </Card>

          {selectedVideo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Video Player */}
              <Card>
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
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Arabic Transcript</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="view-mode"
                          checked={viewMode === 'text'}
                          onCheckedChange={(checked) => setViewMode(checked ? 'text' : 'segments')}
                        />
                        <label htmlFor="view-mode" className="text-sm text-gray-600 cursor-pointer">
                          SRT Format
                        </label>
                      </div>
                      <Button 
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {viewMode === 'segments' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {arabicSegments.length} segments
                        </span>
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
                              className="min-h-[80px] text-right direction-rtl"
                              dir="rtl"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800 flex items-start space-x-2">
                          <FileText size={16} className="mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>SRT Format View:</strong> Edit your Arabic transcript in standard SubRip (.srt) format. 
                            Each segment shows: sequence number, timestamp range, and text.
                          </span>
                        </p>
                      </div>
                      <Textarea
                        value={srtTextContent}
                        onChange={(e) => handleSrtTextChange(e.target.value)}
                        placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;مرحبا بكم في هذا الفيديو...&#10;&#10;2&#10;00:00:05,000 --> 00:00:08,000&#10;اليوم سوف نناقش الموضوع الرئيسي..."
                        className="min-h-[400px] text-right direction-rtl font-mono text-sm"
                        dir="rtl"
                      />
                    </div>
                  )}
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