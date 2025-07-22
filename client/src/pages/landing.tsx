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
import { Video, FileText, Play, Clock, Languages, LogIn, ChevronLeft, ChevronRight, Search, X, Plus, Minus, List } from "lucide-react";
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
  const [showPlaylistPanel] = useState(true);
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

        {/* Playlist and Video Selectors */}
        <div className="mb-4">
          <div className="bg-white rounded-lg shadow-md border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <List size={16} className="text-indigo-600" />
                  <span className="text-sm font-medium text-slate-700">Playlist:</span>
                  <Select 
                    value={selectedPlaylist?.toString()} 
                    onValueChange={(value) => {
                      setSelectedPlaylist(parseInt(value));
                      setSelectedVideo(null);
                    }}
                  >
                    <SelectTrigger className="w-80 h-9">
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
                  <>
                    <div className="flex items-center space-x-2">
                      <Play size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-slate-700">Video:</span>
                      <Select 
                        value={selectedVideo?.id?.toString() || ""} 
                        onValueChange={(value) => {
                          const video = playlistVideos.find((v: any) => v.id.toString() === value);
                          setSelectedVideo(video);
                        }}
                      >
                        <SelectTrigger className="w-[42rem] h-9">
                          <SelectValue placeholder="Choose video" />
                        </SelectTrigger>
                        <SelectContent className="w-[42rem]">
                          {playlistVideos.map((video: any) => (
                            <SelectItem key={video.id} value={video.id.toString()}>
                              <div className="flex items-center space-x-3 py-1 w-full">
                                <img 
                                  src={video.thumbnailUrl} 
                                  alt={video.title}
                                  className="w-12 h-9 rounded object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate max-w-[520px]">
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
                  </>
                )}
              </div>
              
              {selectedPlaylist && Array.isArray(playlistVideos) && playlistVideos.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {playlistVideos.length} videos
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Top Row: Video and Transcript */}
        {selectedPlaylist && (
          <>
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              {/* Video Player Column */}
              <div className="lg:col-span-2">
                {selectedVideo ? (
                  <Card className="shadow-md border bg-white" style={{ height: '600px' }}>
                    <CardContent className="p-0 h-full flex flex-col">
                      <div className="bg-slate-900 rounded-t-lg overflow-hidden" style={{ height: '480px' }}>
                        <div ref={playerRef} className="w-full h-full" />
                      </div>
                      <div className="p-2 flex-1">
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
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {selectedVideo.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-md border bg-gradient-to-br from-slate-50 to-slate-100" style={{ height: '600px' }}>
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

              {/* Transcript Column */}
              <div className="lg:col-span-1 h-full">
                <Card className="shadow-md border bg-white flex flex-col" style={{ height: '600px' }}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-lg flex items-center font-bold text-slate-900">
                        <FileText size={18} className="text-indigo-600 mr-2" />
                        Transcript
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        {/* Font Size Controls */}
                        {segments.length > 0 && (
                          <div className="flex items-center space-x-1 bg-slate-100 rounded p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={decreaseFontSize}
                              disabled={fontSize <= 10}
                              className="h-5 w-5 p-0"
                              title="Decrease font size"
                            >
                              <Minus size={8} />
                            </Button>
                            <span className="text-xs font-medium text-slate-700 w-5 text-center">
                              {fontSize}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={increaseFontSize}
                              disabled={fontSize >= 24}
                              className="h-5 w-5 p-0"
                              title="Increase font size"
                            >
                              <Plus size={8} />
                            </Button>
                          </div>
                        )}
                        
                        {availableLanguages.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Languages size={12} className="text-slate-500" />
                            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                              <SelectTrigger className="w-24 h-7 text-xs">
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
                      </div>
                    </div>
                    
                    {/* Search Interface */}
                    {segments.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2">
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
                  </CardHeader>
                  
                  <CardContent className="flex-1 pt-0 px-4 pb-4">
                    <div ref={transcriptRef} className="space-y-1 h-full overflow-y-auto pr-2" style={{ height: '480px' }}>
                  {segments.map((segment, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                        index === activeSegmentIndex
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 shadow-sm transform scale-[1.02]'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-sm'
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
            </div>

            {/* Bottom Row - Playlist Panel */}
            {selectedPlaylist && Array.isArray(playlistVideos) && playlistVideos.length > 1 && (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Video size={18} className="mr-2" />
                      Videos ({Array.isArray(playlistVideos) ? playlistVideos.length : 0})
                    </CardTitle>
                    <CardDescription>
                      Click a video to play it
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-y-auto" style={{ maxHeight: '420px' }}>
                      {Array.isArray(playlistVideos) && playlistVideos.map((video: any) => (
                        <div
                          key={video.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                            selectedVideo?.id === video.id
                              ? 'bg-blue-50 border-blue-200 shadow-sm'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                          onClick={() => setSelectedVideo(video)}
                        >
                          <div className="flex flex-col space-y-2">
                            <img 
                              src={video.thumbnailUrl} 
                              alt={video.title}
                              className="w-full aspect-video rounded object-cover"
                            />
                            <div>
                              <h4 className="font-medium text-sm text-slate-900 line-clamp-2 mb-1">
                                {video.title}
                              </h4>
                              <Badge variant="secondary" className="text-xs">
                                <Clock size={10} className="mr-1" />
                                {video.duration}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )) || (
                        <div className="col-span-full text-center py-6 text-slate-500">
                          <Video size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No videos in this playlist</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
