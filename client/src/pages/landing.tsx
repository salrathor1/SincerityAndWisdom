import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Video, FileText, Play, Clock, Languages, LogIn, ChevronLeft, ChevronRight, Search, X, Plus, Minus, List, Share2, Copy, CheckCircle, Link, Scissors, ChevronDown, AlertTriangle } from "lucide-react";
import { TranslatedText } from "@/components/TranslatedText";
import { useToast } from "@/hooks/use-toast";
import { ReportProblemModal } from "@/components/ui/report-problem-modal";
import { useAuth } from "@/hooks/useAuth";
import { SupportRibbon } from "@/components/support-ribbon";

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

export default function Landing() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("ar");
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPlaylistPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [fontSize, setFontSize] = useState(14); // Base font size in pixels
  const [showReportModal, setShowReportModal] = useState(false);
  const [fromSegment, setFromSegment] = useState<number | null>(null);
  const [toSegment, setToSegment] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'from' | 'to'>('from');
  const [sharedSegmentRange, setSharedSegmentRange] = useState<{start: number, end: number} | null>(null);
  const [activeTab, setActiveTab] = useState("transcript");
  const playerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Get language-specific approval status
  const getApprovalStatusForLanguage = (transcript: any, language: string): string => {
    const approvalStatusMap: { [key: string]: string } = {
      'ar': transcript.approvalStatusAr || 'unchecked',
      'en': transcript.approvalStatusEn || 'unchecked',
      'ur': transcript.approvalStatusUr || 'unchecked',
      'fr': transcript.approvalStatusFr || 'unchecked',
      'es': transcript.approvalStatusEs || 'unchecked',
      'tr': transcript.approvalStatusTr || 'unchecked',
      'ms': transcript.approvalStatusMs || 'unchecked'
    };
    return approvalStatusMap[language] || 'unchecked';
  };

  // Fetch playlists for public viewing
  const { data: playlists } = useQuery({
    queryKey: ["/api/playlists"],
  });

  // Fetch videos for selected playlist
  const { data: playlistVideos } = useQuery({
    queryKey: ["/api/playlists", selectedPlaylist, "videos"],
    enabled: !!selectedPlaylist,
  });

  // Fetch transcripts for selected video
  const { data: videoTranscripts } = useQuery({
    queryKey: ["/api/videos", selectedVideo?.id, "transcripts"],
    enabled: !!selectedVideo?.id,
  });

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const currentTranscript = Array.isArray(videoTranscripts) ? videoTranscripts.find((t: any) => t.language === selectedLanguage) : null;
  const segments: TranscriptSegment[] = currentTranscript?.content || [];

  const availableLanguages = Array.isArray(videoTranscripts) ? videoTranscripts.map((t: any) => ({
    code: t.language,
    name: t.language === "en" ? "English" : t.language === "ar" ? "Arabic" : t.language.toUpperCase()
  })) : [];

  // Check URL parameters for shared segment on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('playlist');
    const videoId = urlParams.get('video');
    const startTime = urlParams.get('start');
    const endTime = urlParams.get('end');
    const lang = urlParams.get('lang');
    
    if (playlistId && videoId && startTime && endTime) {
      setSelectedPlaylist(parseInt(playlistId));
      setSharedSegmentRange({
        start: parseFloat(startTime),
        end: parseFloat(endTime)
      });
      
      // Set language if specified
      if (lang) {
        setSelectedLanguage(lang);
      }
    } else {
      // If no shared segment parameters, check for regular playlist/video parameters
      if (playlistId) {
        setSelectedPlaylist(parseInt(playlistId));
      }
      if (lang) {
        setSelectedLanguage(lang);
      }
    }
  }, []);

  // Auto-select video from URL parameters when playlist videos are loaded
  useEffect(() => {
    if (Array.isArray(playlistVideos) && playlistVideos.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('video');
      
      if (videoId) {
        const targetVideo = playlistVideos.find((v: any) => v.id.toString() === videoId);
        if (targetVideo) {
          setSelectedVideo(targetVideo);
          return; // Found and set the target video, exit early
        }
      }
      
      // If no specific video ID in URL or video not found, select first video
      if (!selectedVideo) {
        setSelectedVideo(playlistVideos[0]);
      }
    }
  }, [playlistVideos, selectedVideo]);

  // Auto-play shared segment when video and transcripts are loaded
  useEffect(() => {
    if (player && sharedSegmentRange && segments.length > 0) {
      const startSegmentIndex = segments.findIndex(segment => 
        parseTimeToSeconds(segment.time) >= sharedSegmentRange.start
      );
      
      // Find the end segment more accurately - get the segment that contains or follows the end time
      let endSegmentIndex = segments.findIndex(segment => 
        parseTimeToSeconds(segment.time) > sharedSegmentRange.end
      );
      
      // If no segment found after end time, use the last segment
      if (endSegmentIndex === -1) {
        endSegmentIndex = segments.length - 1;
      } else {
        // Use the previous segment (the one that contains the end time)
        endSegmentIndex = Math.max(0, endSegmentIndex - 1);
      }
      
      if (startSegmentIndex !== -1) {
        setActiveSegmentIndex(startSegmentIndex);
        
        // Play from start time
        player.seekTo(sharedSegmentRange.start);
        player.playVideo();
        
        // Debug logging to understand the timing
        console.log(`Shared segment: ${sharedSegmentRange.start}s to ${sharedSegmentRange.end}s`);
        console.log(`Will pause when video reaches ${sharedSegmentRange.end}s`);
      }
    }
  }, [player, sharedSegmentRange, segments]);

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

  // Load YouTube iframe API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube iframe API ready');
      };
    }
  }, []);

  // Create YouTube player when video changes
  useEffect(() => {
    if (selectedVideo && window.YT && window.YT.Player && playerRef.current) {
      if (player) {
        player.destroy();
      }

      // Clear the container and create a new div for the player
      playerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      playerRef.current.appendChild(playerDiv);

      const newPlayer = new window.YT.Player(playerDiv, {
        height: '100%',
        width: '100%',
        videoId: selectedVideo.youtubeId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            console.log('Player ready for:', selectedVideo.title);
            setPlayer(event.target);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              startTimeTracking(event.target);
            }
          },
        },
      });
    }
  }, [selectedVideo, window.YT]);

  // Track current time and update active segment  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (player && segments.length > 0) {
      const trackTime = () => {
        if (player.getCurrentTime) {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          
          // Find active segment based on current time
          const activeIndex = segments.findIndex((segment, index) => {
            const segmentTime = parseTimeToSeconds(segment.time);
            const nextSegmentTime = index < segments.length - 1 
              ? parseTimeToSeconds(segments[index + 1].time) 
              : Infinity;
            return time >= segmentTime && time < nextSegmentTime;
          });
          
          if (activeIndex !== -1 && activeIndex !== activeSegmentIndex) {
            setActiveSegmentIndex(activeIndex);
          }
        }
      };

      interval = setInterval(trackTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [player, segments, activeSegmentIndex]);

  const startTimeTracking = (playerInstance: any) => {
    // This function can be empty now since we handle tracking in the useEffect above
    console.log('Starting time tracking for player');
  };



  // Search functionality
  const performSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim() || segments.length === 0) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const results: number[] = [];
    segments.forEach((segment, index) => {
      if (segment.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);

    // Auto-scroll to first result
    if (results.length > 0) {
      setActiveSegmentIndex(results[0]);
      scrollToSegment(results[0]);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    } else {
      newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    }

    setCurrentSearchIndex(newIndex);
    const segmentIndex = searchResults[newIndex];
    setActiveSegmentIndex(segmentIndex);
    scrollToSegment(segmentIndex);
  };

  const scrollToSegment = (index: number) => {
    if (transcriptRef.current) {
      const segmentElement = transcriptRef.current.children[index] as HTMLElement;
      if (segmentElement) {
        segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        `<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">${part}</mark>` : 
        part
    ).join('');
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24)); // Max 24px
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 10)); // Min 10px
  };

  const resetFontSize = () => {
    setFontSize(14); // Reset to default
  };

  // Handle report problem
  const handleReportProblem = () => {
    setShowReportModal(true);
  };

  // Handle segment selection for sharing - simplified from/to system
  const handleSegmentClick = (segmentIndex: number, time?: string, event?: React.MouseEvent) => {
    // Clear search when user clicks on a segment (if currently searching)
    if (searchQuery.trim() !== '') {
      setSearchQuery('');
      setSearchResults([]);
      setCurrentSearchIndex(-1);
    }
    
    if (isSelecting) {
      event?.preventDefault();
      
      if (selectionStep === 'from') {
        // First click - set FROM segment
        setFromSegment(segmentIndex);
        setToSegment(null);
        setSelectionStep('to');
      } else {
        // Second click - set TO segment and generate URL
        const fromIndex = fromSegment!;
        const toIndex = segmentIndex;
        
        // Ensure from is always before to
        const startIndex = Math.min(fromIndex, toIndex);
        const endIndex = Math.max(fromIndex, toIndex);
        
        setToSegment(endIndex);
        
        // Generate and copy URL immediately
        generateAndCopyShareableLink(startIndex, endIndex);
        
        // Reset selection mode after successful copy
        setTimeout(() => {
          setIsSelecting(false);
          setFromSegment(null);
          setToSegment(null);
          setSelectionStep('from');
        }, 1000);
      }
      
      return;
    }
    
    // Regular navigation behavior
    if (player && segments.length > 0) {
      const segmentTime = time ? parseTimeToSeconds(time) : parseTimeToSeconds(segments[segmentIndex].time);
      setActiveSegmentIndex(segmentIndex);
      player.seekTo(segmentTime, true);
      player.playVideo();
    }
  };

  // Toggle selection mode for from/to selection
  const toggleSelectionMode = () => {
    setIsSelecting(!isSelecting);
    setFromSegment(null);
    setToSegment(null);
    setSelectionStep('from');
  };

  // Generate and copy shareable link immediately for from/to segments
  const generateAndCopyShareableLink = async (startIndex: number, endIndex: number) => {
    if (!selectedVideo || !selectedPlaylist) return;
    
    const startTime = parseTimeToSeconds(segments[startIndex].time);
    
    // Calculate end time to include the complete "to" segment
    let endTime: number;
    if (endIndex < segments.length - 1) {
      // Use the start time of the next segment as the end time
      endTime = parseTimeToSeconds(segments[endIndex + 1].time);
    } else {
      // For the last segment, add a reasonable duration (e.g., 10 seconds)
      endTime = parseTimeToSeconds(segments[endIndex].time) + 10;
    }
    
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?playlist=${selectedPlaylist}&video=${selectedVideo.id}&start=${startTime}&end=${endTime}&lang=${selectedLanguage}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share this segment with others",
        variant: "default",
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually from the address bar",
        variant: "destructive",
      });
    }
  };



  // Auto-select Khutbahs playlist by default, fallback to first playlist
  useEffect(() => {
    if (Array.isArray(playlists) && playlists.length > 0 && !selectedPlaylist) {
      const urlParams = new URLSearchParams(window.location.search);
      const hasUrlPlaylist = urlParams.get('playlist');
      
      // Only auto-select if no URL playlist parameter exists
      if (!hasUrlPlaylist) {
        // Try to find "Khutbahs" playlist first
        const khutbahsPlaylist = playlists.find((playlist: any) => 
          playlist.name.toLowerCase().includes('khutbah')
        );
        
        if (khutbahsPlaylist) {
          setSelectedPlaylist(khutbahsPlaylist.id);
        } else {
          // Fallback to first playlist if Khutbahs not found
          setSelectedPlaylist(playlists[0].id);
        }
      }
    }
  }, [playlists, selectedPlaylist]);

  // Auto-scroll to active segment
  // Auto-scroll to active segment only when not searching
  useEffect(() => {
    // Don't auto-scroll if user is currently searching to avoid interfering with manual navigation
    if (searchQuery.trim() !== '') {
      return;
    }
    
    if (transcriptRef.current && activeSegmentIndex >= 0) {
      const activeElement = transcriptRef.current.children[activeSegmentIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeSegmentIndex, searchQuery]);

  // Track current time for shared segment highlighting during playback
  useEffect(() => {
    if (player && sharedSegmentRange) {
      let hasCompletedSegment = false;
      
      const interval = setInterval(() => {
        if (player.getCurrentTime && player.getPlayerState) {
          const currentTime = player.getCurrentTime();
          const playerState = player.getPlayerState();
          
          // Log every few seconds for debugging
          if (Math.floor(currentTime) % 2 === 0) {
            console.log(`Playing: ${currentTime.toFixed(1)}s / ${sharedSegmentRange.end}s`);
          }
          
          // Check if we've reached the end time and should pause (only once)
          if (currentTime >= sharedSegmentRange.end && !hasCompletedSegment) {
            console.log(`PAUSING: Current time ${currentTime.toFixed(1)}s reached target ${sharedSegmentRange.end}s`);
            hasCompletedSegment = true;
            player.pauseVideo();
            // Don't clear interval here - let it continue for highlighting
            return;
          }
          
          // After segment completion, if user resumes playing, stop monitoring the segment boundary
          if (hasCompletedSegment && playerState === 1) { // 1 = playing
            console.log(`User resumed playback after segment completion - allowing normal playback`);
            clearInterval(interval);
            return;
          }
          
          // Find the current segment being played (for highlighting)
          const currentSegmentIndex = segments.findIndex((segment, index) => {
            const segmentTime = parseTimeToSeconds(segment.time);
            const nextSegmentTime = index < segments.length - 1 ? 
              parseTimeToSeconds(segments[index + 1].time) : 
              segmentTime + 10;
            
            return currentTime >= segmentTime && currentTime < nextSegmentTime;
          });
          
          if (currentSegmentIndex !== -1 && currentSegmentIndex !== activeSegmentIndex) {
            setActiveSegmentIndex(currentSegmentIndex);
          }
        }
      }, 100); // Check more frequently (every 100ms) for better precision
      
      return () => clearInterval(interval);
    }
  }, [player, sharedSegmentRange, segments, activeSegmentIndex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-2 sm:py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M9 12c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.22-1.21 4.15-3 5.19V22h-6v-4.81c-1.79-1.04-3-2.97-3-5.19z" fill="currentColor"/>
                <circle cx="15" cy="12" r="2" fill="#059669"/>
                <path d="m11 17 4 4V15z" fill="#059669"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sincerity and Wisdom</h1>
              <p className="text-xs sm:text-sm text-slate-600 truncate">Watch videos with synchronized transcripts</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <Button 
                onClick={() => setShowReportModal(true)} 
                variant="outline" 
                size="sm" 
                className="flex-shrink-0"
              >
                <AlertTriangle size={16} className="mr-2" />
                <span className="hidden sm:inline">Report Problem</span>
                <span className="sm:hidden">Report</span>
              </Button>
            )}
            <Button onClick={handleLogin} variant="outline" size="sm" className="self-start sm:self-center flex-shrink-0 hidden sm:flex">
              <LogIn size={16} className="mr-2" />
              <span>Admin Login</span>
            </Button>
          </div>
        </div>

        {/* Playlist and Video Selectors */}
        <div className="mb-4">
          <div className="bg-white rounded-lg shadow-md border p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <List size={16} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">Playlist:</span>
                  <Select 
                    value={selectedPlaylist?.toString()} 
                    onValueChange={(value) => {
                      setSelectedPlaylist(parseInt(value));
                      setSelectedVideo(null);
                      
                      // Clear shared segment range when changing playlist
                      setSharedSegmentRange(null);
                      
                      // Update URL parameters to reflect the new playlist selection
                      const newUrl = new URL(window.location.href);
                      newUrl.searchParams.set('playlist', value);
                      // Remove video and segment-specific parameters
                      newUrl.searchParams.delete('video');
                      newUrl.searchParams.delete('start');
                      newUrl.searchParams.delete('end');
                      if (selectedLanguage !== 'ar') {
                        newUrl.searchParams.set('lang', selectedLanguage);
                      }
                      
                      // Update URL without page reload
                      window.history.pushState({}, '', newUrl.toString());
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-80 h-9">
                      <SelectValue placeholder="Choose playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(playlists) && playlists.map((playlist: any) => (
                        <SelectItem key={playlist.id} value={playlist.id.toString()}>
                          {playlist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedPlaylist && Array.isArray(playlistVideos) && playlistVideos.length > 0 && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Play size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 flex-shrink-0">Video:</span>
                    <Select 
                      value={selectedVideo?.id?.toString() || ""} 
                      onValueChange={(value) => {
                        const video = playlistVideos.find((v: any) => v.id.toString() === value);
                        setSelectedVideo(video);
                        
                        // Clear shared segment range when manually selecting a different video
                        setSharedSegmentRange(null);
                        
                        // Update URL to reflect the new video selection without shared segment params
                        const newUrl = new URL(window.location.href);
                        if (selectedPlaylist) {
                          newUrl.searchParams.set('playlist', selectedPlaylist.toString());
                        }
                        newUrl.searchParams.set('video', value);
                        if (selectedLanguage !== 'ar') {
                          newUrl.searchParams.set('lang', selectedLanguage);
                        }
                        // Remove segment-specific parameters
                        newUrl.searchParams.delete('start');
                        newUrl.searchParams.delete('end');
                        window.history.replaceState({}, '', newUrl.toString());
                      }}
                    >
                      <SelectTrigger className="w-full min-w-0 h-9">
                        <SelectValue placeholder="Choose video" />
                      </SelectTrigger>
                      <SelectContent className="w-full max-w-2xl">
                        {playlistVideos
                          .sort((a: any, b: any) => (a.playlistOrder || 0) - (b.playlistOrder || 0) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                          .map((video: any) => (
                          <SelectItem key={video.id} value={video.id.toString()}>
                            <div className="flex items-center space-x-3 py-1 w-full">
                              <img 
                                src={video.thumbnailUrl} 
                                alt={video.title}
                                className="w-12 h-9 rounded object-cover flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {video.title}
                                </div>
                                <div className="text-xs text-slate-500">
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
              </div>
              
              {selectedPlaylist && Array.isArray(playlistVideos) && playlistVideos.length > 0 && (
                <Badge variant="outline" className="text-xs flex-shrink-0 self-start sm:self-center hidden sm:inline-flex">
                  {playlistVideos.length} videos
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Top Row: Video and Transcript */}
        {selectedPlaylist && (
          <>
            <div className="flex flex-col lg:grid lg:gap-6 xl:grid-cols-3 gap-4 mb-6">
              {/* Video Player Column */}
              <div className="xl:col-span-2">
                {selectedVideo ? (
                  <Card className="shadow-md border bg-white flex flex-col min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] xl:h-auto">
                    <CardContent className="p-0 flex flex-col">
                      <div className="bg-slate-900 rounded-t-lg overflow-hidden relative" style={{paddingBottom: 'calc(56.25% + 25px)'}}>
                        <div ref={playerRef} className="absolute inset-0 w-full h-full" />
                      </div>
                      <div className="p-3 lg:p-2 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-slate-900 mb-1 line-clamp-2">
                              {selectedVideo.title}
                            </h2>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                <Play size={10} className="mr-1" />
                                Playing
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock size={10} className="mr-1" />
                                {selectedVideo.duration}
                              </Badge>
                            </div>
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-md border bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] xl:h-auto">
                    <CardContent className="p-6 text-center h-full flex flex-col justify-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Video size={24} className="text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Select a Video</h3>
                      <p className="text-slate-600 text-sm">
                        Choose a playlist and video to start watching
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Transcript & Vocabulary Column */}
              <div className="xl:col-span-1">
                <Card className="shadow-md border bg-white flex flex-col min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] xl:h-auto">
                  <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <div className="flex items-center justify-between mb-3">
                        <TabsList className="grid grid-cols-2 flex-1 mr-2">
                          <TabsTrigger value="transcript" className="flex items-center space-x-1">
                            <FileText size={14} />
                            <span>Transcript</span>
                          </TabsTrigger>
                          <TabsTrigger value="vocabulary" className="flex items-center space-x-1">
                            <Languages size={14} />
                            <span>Vocabulary</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Report Problem Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReportProblem}
                          className="h-8 px-3 text-xs border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 transition-colors"
                          title="Report an issue with this content"
                        >
                          <AlertTriangle size={12} className="mr-1 text-orange-600" />
                          <span className="hidden sm:inline">Report</span>
                        </Button>
                      </div>
                      
                      {/* Transcript Tab */}
                      <TabsContent value="transcript" className="mt-0 space-y-0">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div></div>
                          <div className="flex items-center space-x-1 sm:space-x-2 w-full">
                        {/* Font Size Controls */}
                        {segments.length > 0 && (
                          <div className="flex items-center space-x-1 bg-slate-100 rounded p-1 flex-1 h-7">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={decreaseFontSize}
                              disabled={fontSize <= 10}
                              className="h-5 flex-1 p-0"
                              title="Decrease font size"
                            >
                              <Minus size={10} />
                            </Button>
                            <span className="text-xs font-medium text-slate-700 px-2 text-center">
                              {fontSize}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={increaseFontSize}
                              disabled={fontSize >= 24}
                              className="h-5 flex-1 p-0"
                              title="Increase font size"
                            >
                              <Plus size={10} />
                            </Button>
                          </div>
                        )}
                        
                        {availableLanguages.length > 0 && (
                          <div className="flex items-center space-x-1 flex-1">
                            <Languages size={12} className="text-slate-500 flex-shrink-0" />
                            <Select value={selectedLanguage} onValueChange={(value) => {
                              setSelectedLanguage(value);
                              
                              // Update URL parameters to reflect language change
                              const newUrl = new URL(window.location.href);
                              if (value !== 'ar') {
                                newUrl.searchParams.set('lang', value);
                              } else {
                                newUrl.searchParams.delete('lang');
                              }
                              
                              // Update URL without page reload
                              window.history.pushState({}, '', newUrl.toString());
                            }}>
                              <SelectTrigger className="w-full h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableLanguages.map((lang: any) => (
                                  <SelectItem key={lang.code} value={lang.code} className="text-xs">
                                    {lang.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        

                        

                        
                        {/* Selection and Share Controls */}
                        {segments.length > 0 && (
                          <div className="flex items-center space-x-1 flex-1">
                            {!isSelecting ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs w-full"
                                  >
                                    <Share2 size={9} className="mr-1" />
                                    <span className="hidden sm:inline">Share</span>
                                    <ChevronDown size={7} className="ml-auto" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-28 text-xs">
                                  <DropdownMenuItem onClick={async () => {
                                    // Share current page URL with current playlist, video, and language
                                    const baseUrl = window.location.origin + window.location.pathname;
                                    
                                    // Build URL with current state
                                    const cleanParams = new URLSearchParams();
                                    if (selectedPlaylist) cleanParams.set('playlist', selectedPlaylist.toString());
                                    if (selectedVideo) cleanParams.set('video', selectedVideo.id.toString());
                                    if (selectedLanguage !== 'ar') cleanParams.set('lang', selectedLanguage);
                                    
                                    const cleanUrl = cleanParams.toString() ? `${baseUrl}?${cleanParams.toString()}` : baseUrl;
                                    
                                    try {
                                      await navigator.clipboard.writeText(cleanUrl);
                                      toast({
                                        title: "Link copied!",
                                        description: `Link to ${selectedVideo?.title || 'current video'} copied`,
                                        variant: "default",
                                      });
                                    } catch (err) {
                                      console.error('Failed to copy: ', err);
                                      toast({
                                        title: "Copy failed",
                                        description: "Please copy the URL manually from the address bar",
                                        variant: "destructive",
                                      });
                                    }
                                  }}>
                                    <Link size={10} className="mr-1" />
                                    Share Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={toggleSelectionMode}>
                                    <Scissors size={10} className="mr-1" />
                                    Create Segment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={toggleSelectionMode}
                                className="h-6 w-6 p-0"
                                title="Exit selection mode"
                              >
                                <X size={10} />
                              </Button>
                            )}
                            
                            {isSelecting && (
                              <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {selectionStep === 'from' ? 'Click FROM segment' : 'Click TO segment'}
                                {fromSegment !== null && selectionStep === 'to' && (
                                  <span className="ml-1 text-blue-600">
                                    (From: {segments[fromSegment]?.time})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Selection Instructions */}
                    {isSelecting && segments.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                        <p className="text-xs text-blue-800">
                          <strong>Create Segment:</strong> First click selects FROM segment, second click selects TO segment. The shareable link will be automatically copied to your clipboard.
                        </p>
                      </div>
                    )}
                    
                    {/* Approval Status Badge - Full Width under all controls */}
                    {currentTranscript && (
                      <div className="w-full px-2 mb-6">
                        <Badge 
                          variant={getApprovalStatusForLanguage(currentTranscript, selectedLanguage) === 'approved' ? 'default' : 'destructive'}
                          className={`w-full justify-center text-xs py-2 ${
                            getApprovalStatusForLanguage(currentTranscript, selectedLanguage) === 'approved' 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {getApprovalStatusForLanguage(currentTranscript, selectedLanguage) === 'approved' ? 'Checked' : 'Unchecked'}
                        </Badge>
                      </div>
                    )}

                    {/* Search Interface */}
                    {segments.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2 mt-4">
                        <div className="relative flex-1">
                          <Search size={12} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => performSearch(e.target.value)}
                            className="pl-7 pr-6 h-7 text-xs"
                          />
                          {searchQuery && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearSearch}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-4 w-4 p-0"
                            >
                              <X size={10} />
                            </Button>
                          )}
                        </div>
                        
                        {searchResults.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {currentSearchIndex + 1}/{searchResults.length}
                            </span>
                            <div className="flex">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateSearch('prev')}
                                className="h-6 w-6 p-0"
                              >
                                <ChevronLeft size={10} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateSearch('next')}
                                className="h-6 w-6 p-0 ml-1"
                              >
                                <ChevronRight size={10} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                      </TabsContent>
                      
                      {/* Vocabulary Tab */}
                      <TabsContent value="vocabulary" className="mt-0 space-y-0">
                        <CardContent className="flex-1 pt-0 px-3 sm:px-4 pb-3 sm:pb-4">
                          <div className="h-[240px] sm:h-[320px] lg:h-[400px] xl:h-[450px]">
                            {selectedVideo?.vocabulary ? (
                              <div className="h-full overflow-y-auto px-2 py-3">
                                <div className="prose prose-sm max-w-none">
                                  <p 
                                    className="whitespace-pre-wrap leading-relaxed text-slate-700"
                                    style={{ fontSize: '18px' }}
                                  >
                                    {selectedVideo.vocabulary}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center text-center">
                                <div className="space-y-3">
                                  <Languages size={32} className="mx-auto opacity-50 text-slate-400" />
                                  <div>
                                    <p className="text-slate-600 font-medium">No vocabulary notes available</p>
                                    <p className="text-slate-500 text-sm">
                                      {selectedVideo ? 'This video doesn\'t have vocabulary notes yet.' : 'Select a video to see vocabulary notes.'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </TabsContent>
                    </Tabs>
                  </CardHeader>
                  
                  <CardContent className="flex-1 pt-0 px-3 sm:px-4 pb-3 sm:pb-4">
                    {activeTab === "transcript" && (
                    <div 
                      ref={transcriptRef} 
                      className={`space-y-1 overflow-y-auto ${selectedLanguage === 'ar' ? 'pl-1 sm:pl-2' : 'pr-1 sm:pr-2'} h-48 sm:h-64 lg:h-80 xl:h-[400px]`} 
                      style={{ 
                        direction: selectedLanguage === 'ar' ? 'rtl' : 'ltr'
                      }}
                    >
                      {segments.map((segment, index) => {
                        const isFromSelected = fromSegment === index;
                        const isToSelected = toSegment === index;
                        const isInRange = fromSegment !== null && toSegment !== null && 
                          index >= Math.min(fromSegment, toSegment) && 
                          index <= Math.max(fromSegment, toSegment);
                        const isActive = index === activeSegmentIndex;
                        
                        // Enhanced shared segment highlighting - only highlight segments that will play completely
                        const isShared = sharedSegmentRange && segments.length > 0 && (() => {
                          const segmentTime = parseTimeToSeconds(segment.time);
                          const nextSegmentTime = index < segments.length - 1 ? 
                            parseTimeToSeconds(segments[index + 1].time) : 
                            segmentTime + 10; // Assume 10 seconds for last segment
                          
                          // Only highlight if the segment starts within the range AND will play completely
                          // (i.e., the next segment starts before or at the shared range end)
                          return segmentTime >= sharedSegmentRange.start && 
                                 segmentTime < sharedSegmentRange.end &&
                                 nextSegmentTime <= sharedSegmentRange.end;
                        })();
                        
                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                              isShared && isActive
                                ? 'bg-gradient-to-r from-orange-200 to-yellow-200 border-orange-400 shadow-lg ring-2 ring-orange-300 transform scale-[1.02]'
                                : isShared
                                ? 'bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-300 shadow-md ring-2 ring-orange-200'
                                : isFromSelected
                                ? 'bg-gradient-to-r from-green-100 to-green-50 border-green-300 shadow-sm ring-2 ring-green-200'
                                : isToSelected 
                                ? 'bg-gradient-to-r from-red-100 to-red-50 border-red-300 shadow-sm ring-2 ring-red-200'
                                : isInRange
                                ? 'bg-gradient-to-r from-blue-100 to-blue-50 border-blue-300 shadow-sm'
                                : isActive
                                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 shadow-sm transform scale-[1.02]'
                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                            } ${isSelecting ? 'ring-2 ring-transparent hover:ring-blue-200' : ''}`}
                            style={{
                              direction: selectedLanguage === 'ar' ? 'rtl' : 'ltr'
                            }}
                            onClick={(e) => handleSegmentClick(index, segment.time, e)}
                          >
                            <div className={`flex items-start ${selectedLanguage === 'ar' ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                              <Badge variant="secondary" className="text-xs flex-shrink-0 mt-0.5">
                                {segment.time}
                              </Badge>
                              {selectedLanguage === 'ar' ? (
                                <div 
                                  className="leading-relaxed text-right arabic-font"
                                  style={{ fontSize: `${fontSize}px` }}
                                >
                                  {searchQuery ? (
                                    <span 
                                      dangerouslySetInnerHTML={{ 
                                        __html: highlightText(segment.text, searchQuery) 
                                      }}
                                    />
                                  ) : (
                                    <TranslatedText 
                                      text={segment.text} 
                                      className=""
                                    />
                                  )}
                                </div>
                              ) : (
                                <p 
                                  className="leading-relaxed text-left"
                                  style={{ fontSize: `${fontSize}px` }}
                                  dangerouslySetInnerHTML={{ 
                                    __html: searchQuery ? highlightText(segment.text, searchQuery) : segment.text 
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      }) || (
                        <div className="text-center py-8 text-slate-500">
                          <FileText size={32} className="mx-auto mb-3 opacity-50" />
                          <p>No transcript available for this video in {selectedLanguage === 'ar' ? 'Arabic' : 'English'}</p>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Bottom Row - Playlist Panel */}

          </>
        )}
      </div>


      <ReportProblemModal 
        isOpen={showReportModal} 
        onOpenChange={setShowReportModal}
        currentVideo={selectedVideo}
        currentPlaylist={Array.isArray(playlists) ? playlists.find((p: any) => p.id === selectedPlaylist) : null}
        initialVideoId={selectedVideo?.id?.toString()}
        initialPlaylistId={selectedPlaylist?.toString()}
      />
      
      <SupportRibbon />
    </div>
  );
}
