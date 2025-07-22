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
import { Video, FileText, Play, Clock, Languages, LogIn, ChevronLeft, ChevronRight, Search, X, Plus, Minus } from "lucide-react";
import { TranslatedText } from "@/components/TranslatedText";

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
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [fontSize, setFontSize] = useState(14); // Base font size in pixels
  const playerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

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

  const handleSegmentClick = (index: number, time: string) => {
    setActiveSegmentIndex(index);
    if (player && player.seekTo) {
      const seconds = parseTimeToSeconds(time);
      player.seekTo(seconds, true);
    }
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

  useEffect(() => {
    if (Array.isArray(playlists) && playlists.length > 0 && !selectedPlaylist) {
      setSelectedPlaylist(playlists[0].id);
    }
  }, [playlists, selectedPlaylist]);

  useEffect(() => {
    if (Array.isArray(playlistVideos) && playlistVideos.length > 0 && !selectedVideo) {
      setSelectedVideo(playlistVideos[0]);
    }
  }, [playlistVideos, selectedVideo]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (transcriptRef.current && activeSegmentIndex >= 0) {
      const activeElement = transcriptRef.current.children[activeSegmentIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeSegmentIndex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-2 py-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Video className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">TranscriptHub</h1>
              <p className="text-sm text-slate-600">Watch videos with synchronized transcripts</p>
            </div>
          </div>
          <Button onClick={handleLogin} variant="outline" size="sm">
            <LogIn size={16} className="mr-2" />
            Admin Login
          </Button>
        </div>

        {/* Playlist Selector */}
        <div className="mb-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-slate-700">Select Playlist:</label>
            <Select 
              value={selectedPlaylist?.toString()} 
              onValueChange={(value) => {
                setSelectedPlaylist(parseInt(value));
                setSelectedVideo(null);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a playlist" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(playlists) && playlists.map((playlist: any) => (
                  <SelectItem key={playlist.id} value={playlist.id.toString()}>
                    {playlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlaylistPanel(!showPlaylistPanel)}
            >
              {showPlaylistPanel ? (
                <>
                  <ChevronLeft size={16} className="mr-2" />
                  Hide Playlist Videos
                </>
              ) : (
                <>
                  <ChevronRight size={16} className="mr-2" />
                  Show Playlist Videos
                </>
              )}
            </Button>
            {selectedPlaylist && Array.isArray(playlistVideos) && (
              <Badge variant="secondary">
                {playlistVideos.length} videos
              </Badge>
            )}
          </div>
        </div>

        <div className={`grid gap-4 ${showPlaylistPanel ? 'lg:grid-cols-12' : 'lg:grid-cols-8'}`}>
          {/* Video Player Column */}
          <div className={showPlaylistPanel ? 'lg:col-span-6' : 'lg:col-span-5'}>
            {selectedVideo ? (
              <Card>
                <CardContent className="p-0">
                  <div className="aspect-video bg-slate-900 rounded-t-lg overflow-hidden">
                    <div ref={playerRef} className="w-full h-full" />
                  </div>
                  <div className="p-3">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">
                      {selectedVideo.title}
                    </h2>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {selectedVideo.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Video size={48} className="mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Video</h3>
                  <p className="text-slate-600">
                    Choose a playlist and video to start watching
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Transcript Column */}
          <div className={showPlaylistPanel ? 'lg:col-span-3' : 'lg:col-span-3'}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <FileText size={18} className="mr-2" />
                    Transcript
                  </CardTitle>
                  <div className="flex items-center space-x-3">
                    {/* Font Size Controls */}
                    {segments.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={decreaseFontSize}
                          disabled={fontSize <= 10}
                          className="h-7 w-7 p-0"
                          title="Decrease font size"
                        >
                          <Minus size={12} />
                        </Button>
                        <span className="text-xs text-slate-600 w-8 text-center">
                          {fontSize}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={increaseFontSize}
                          disabled={fontSize >= 24}
                          className="h-7 w-7 p-0"
                          title="Increase font size"
                        >
                          <Plus size={12} />
                        </Button>
                      </div>
                    )}
                    
                    {availableLanguages.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <Languages size={16} className="text-slate-500" />
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLanguages.map((lang: any) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Search Interface */}
                {segments.length > 0 && (
                  <div className="flex items-center space-x-2 mt-3">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search transcript..."
                        value={searchQuery}
                        onChange={(e) => performSearch(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSearch}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-slate-600">
                          {currentSearchIndex + 1} of {searchResults.length}
                        </span>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateSearch('prev')}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateSearch('next')}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <CardDescription className="mt-2">
                  {segments.length > 0 
                    ? `${segments.length} segments available in ${selectedLanguage === 'ar' ? 'Arabic' : 'English'}${searchResults.length > 0 ? ` • ${searchResults.length} matches found` : ''}`
                    : 'No transcript available for this language'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={transcriptRef} className="space-y-2 max-h-96 overflow-y-auto">
                  {segments.map((segment, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded-lg cursor-pointer transition-colors ${
                        index === activeSegmentIndex
                          ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500 shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                      onClick={() => handleSegmentClick(index, segment.time)}
                    >
                      <div className="flex items-start space-x-2">
                        <Badge variant="secondary" className="text-xs flex-shrink-0 mt-0.5">
                          {segment.time}
                        </Badge>
                        {selectedLanguage === 'ar' ? (
                          <div 
                            className="leading-relaxed text-right"
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
                  )) || (
                    <div className="text-center py-8 text-slate-500">
                      <FileText size={32} className="mx-auto mb-3 opacity-50" />
                      <p>No transcript available for this video in {selectedLanguage === 'ar' ? 'Arabic' : 'English'}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Playlist Panel - Videos List */}
          {showPlaylistPanel && (
            <div className="lg:col-span-3">
              <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Play size={18} className="mr-2" />
                  Videos
                </CardTitle>
                <CardDescription>
                  {selectedPlaylist ? `Select a video to watch` : `Choose a playlist first`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {Array.isArray(playlistVideos) && playlistVideos.map((video: any) => (
                    <div
                      key={video.id}
                      className={`p-2 cursor-pointer hover:bg-slate-50 border-l-4 transition-colors ${
                        selectedVideo?.id === video.id 
                          ? 'border-primary bg-blue-50' 
                          : 'border-transparent'
                      }`}
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="flex space-x-2">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-14 h-10 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-slate-900 line-clamp-2">
                            {video.title}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="flex items-center text-xs text-slate-500">
                              <Clock size={12} className="mr-1" />
                              {video.duration}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="p-4 text-center text-slate-500">
                      {selectedPlaylist ? 'No videos in this playlist' : 'Select a playlist to see videos'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
