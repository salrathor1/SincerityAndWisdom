import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, FileText, Play, Clock, Languages, LogIn } from "lucide-react";

interface TranscriptSegment {
  time: string;
  text: string;
}

export default function Landing() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

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

  const handleSegmentClick = (index: number, time: string) => {
    setActiveSegmentIndex(index);
    // Note: Time seeking would need YouTube iframe API integration
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
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
        <div className="mb-6">
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
            {selectedPlaylist && Array.isArray(playlistVideos) && (
              <Badge variant="secondary">
                {playlistVideos.length} videos
              </Badge>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video List */}
          <div className="lg:col-span-1">
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Array.isArray(playlistVideos) && playlistVideos.map((video: any) => (
                    <div
                      key={video.id}
                      className={`p-3 cursor-pointer hover:bg-slate-50 border-l-4 transition-colors ${
                        selectedVideo?.id === video.id 
                          ? 'border-primary bg-blue-50' 
                          : 'border-transparent'
                      }`}
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="flex space-x-3">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-16 h-12 object-cover rounded flex-shrink-0"
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
                    <div className="p-8 text-center text-slate-500">
                      {selectedPlaylist ? 'No videos in this playlist' : 'Select a playlist to see videos'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video Player & Transcript */}
          <div className="lg:col-span-2 space-y-6">
            {selectedVideo ? (
              <>
                {/* Video Player */}
                <Card>
                  <CardContent className="p-0">
                    <div className="aspect-video bg-slate-900 rounded-t-lg overflow-hidden">
                      <iframe
                        src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?enablejsapi=1&origin=${window.location.origin}`}
                        title={selectedVideo.title}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-4">
                      <h2 className="text-lg font-semibold text-slate-900 mb-2">
                        {selectedVideo.title}
                      </h2>
                      <p className="text-sm text-slate-600 line-clamp-3">
                        {selectedVideo.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Transcript Viewer */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <FileText size={18} className="mr-2" />
                        Transcript
                      </CardTitle>
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
                    <CardDescription>
                      {segments.length > 0 
                        ? `${segments.length} segments available in ${selectedLanguage === 'ar' ? 'Arabic' : 'English'}`
                        : 'No transcript available for this language'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {segments.map((segment, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            index === activeSegmentIndex
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                          onClick={() => handleSegmentClick(index, segment.time)}
                        >
                          <div className="flex items-start space-x-3">
                            <Badge variant="secondary" className="text-xs flex-shrink-0 mt-0.5">
                              {segment.time}
                            </Badge>
                            <p className={`text-sm leading-relaxed ${
                              selectedLanguage === 'ar' ? 'text-right' : 'text-left'
                            }`}>
                              {segment.text}
                            </p>
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
              </>
            ) : (
              <Card>
                <CardContent className="p-16 text-center">
                  <Video size={48} className="mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Video</h3>
                  <p className="text-slate-600">
                    Choose a playlist and video from the left to start watching with synchronized transcripts
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
