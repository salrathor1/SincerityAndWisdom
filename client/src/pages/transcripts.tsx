import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TranscriptEditor } from "@/components/transcript-editor";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, FileText, Globe } from "lucide-react";

export default function Transcripts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Redirect to home if not authenticated
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  // Get all videos that have transcripts
  const videosWithTranscripts = videos?.filter((video: any) => 
    video.transcripts && video.transcripts.length > 0
  ) || [];

  // Flatten transcripts with video info for easier filtering
  const allTranscripts = videosWithTranscripts.flatMap((video: any) =>
    video.transcripts.map((transcript: any) => ({
      ...transcript,
      video,
    }))
  );

  // Apply filters
  const filteredTranscripts = allTranscripts.filter((transcript: any) => {
    const matchesSearch = transcript.video.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLanguage = languageFilter === "all" || transcript.language === languageFilter;
    return matchesSearch && matchesLanguage;
  });

  // Get unique languages for filter
  const availableLanguages = [...new Set(allTranscripts.map((t: any) => t.language))];

  const handleEditTranscript = (transcript: any) => {
    setSelectedVideo(transcript.video);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      en: "English",
      ar: "Arabic",
      es: "Spanish",
      fr: "French",
      de: "German",
    };
    return languages[code] || code.toUpperCase();
  };

  const getContentLength = (content: any) => {
    if (!content || !Array.isArray(content)) return 0;
    return content.reduce((total: number, segment: any) => total + (segment.text || "").length, 0);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Transcripts</h2>
              <p className="text-sm text-muted-foreground">Manage and edit video transcripts</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search transcripts..."
                  className="pl-9 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {getLanguageName(lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Transcripts Content */}
        <main className="p-8 overflow-y-auto h-full">
          {videosLoading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex space-x-4">
                      <div className="w-24 h-14 bg-slate-200 rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                        <div className="h-3 bg-slate-200 rounded w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTranscripts.length > 0 ? (
            <div className="space-y-4">
              {filteredTranscripts.map((transcript: any) => (
                <Card key={`${transcript.video.id}-${transcript.language}`} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex space-x-4">
                      <img
                        src={transcript.video.thumbnailUrl || "/placeholder-video.jpg"}
                        alt={transcript.video.title}
                        className="w-24 h-14 rounded object-cover"
                      />
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {transcript.video.title}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTranscript(transcript)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Globe size={14} />
                            <Badge variant="secondary" className="text-xs">
                              {getLanguageName(transcript.language)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <FileText size={14} />
                            <span>
                              {getContentLength(transcript.content)} characters
                            </span>
                          </div>
                          
                          <span>Updated {formatTimeAgo(transcript.updatedAt)}</span>
                          
                          {transcript.isAutoGenerated && (
                            <Badge variant="outline" className="text-xs">
                              Auto-generated
                            </Badge>
                          )}
                        </div>
                        
                        {transcript.video.playlist && (
                          <div className="text-sm text-primary">
                            Playlist: {transcript.video.playlist.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  {searchTerm || languageFilter !== "all" ? (
                    <Search size={32} className="text-muted-foreground" />
                  ) : (
                    <FileText size={32} className="text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchTerm || languageFilter !== "all" ? "No transcripts found" : "No transcripts yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || languageFilter !== "all"
                    ? "Try adjusting your search terms or filters."
                    : "Add videos and create transcripts to see them here."
                  }
                </p>
                {!searchTerm && languageFilter === "all" && (
                  <Button onClick={() => window.location.href = "/videos"}>
                    Go to Videos
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedVideo && (
        <TranscriptEditor
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
