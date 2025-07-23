import { useState, useEffect } from "react";
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
import { Languages, Save, Clock, Plus, Trash2 } from "lucide-react";

interface TranscriptSegment {
  time: string;
  text: string;
}

function getLanguageName(code: string): string {
  const languageMap: { [key: string]: string } = {
    'ar': 'Arabic',
    'en': 'English',
    'ur': 'Urdu',
    'fr': 'French',
    'es': 'Spanish',
    'tr': 'Turkish',
    'ms': 'Malay'
  };
  return languageMap[code] || code;
}

function parseSRTContent(content: any): TranscriptSegment[] {
  if (!content) return [];
  
  // Handle JSONB array content (stored segments)
  if (Array.isArray(content)) {
    return content.map(segment => ({
      time: segment.time || segment.timestamp || "00:00:00,000",
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
          time: startTime,
          text: text
        });
      }
    }
  });
  
  return segments;
}



export default function TranslationsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [translationSegments, setTranslationSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'segments' | 'text'>('segments');

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  }) as { data: any };

  // Redirect if not authenticated
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

  // Fetch transcripts for selected video
  const { data: transcripts = [] } = useQuery<any[]>({
    queryKey: ["/api/videos", selectedVideoId, "transcripts"],
    enabled: !!selectedVideoId,
    retry: false,
  });

  // Get Arabic transcript (read-only reference)
  const arabicTranscript = transcripts.find(t => t.language === 'ar');
  
  // Parse Arabic content into segments
  const arabicSegments = arabicTranscript ? parseSRTContent(arabicTranscript.content) : [];
  
  // Get available translation languages (excluding Arabic)
  const availableLanguages = transcripts
    .filter(t => t.language !== 'ar')
    .map(t => t.language);

  // Get selected language transcript
  const selectedTranscript = transcripts.find(t => t.language === selectedLanguage);

  // Update translation segments when transcript changes
  useEffect(() => {
    if (selectedTranscript) {
      const segments = parseSRTContent(selectedTranscript.content);
      setTranslationSegments(segments);
    } else {
      // Initialize with empty array - user can create their own segments
      setTranslationSegments([]);
    }
  }, [selectedTranscript]);

  // Handle segment text updates
  const handleSegmentTextChange = (index: number, newText: string) => {
    const updatedSegments = [...translationSegments];
    updatedSegments[index] = { ...updatedSegments[index], text: newText };
    setTranslationSegments(updatedSegments);
  };

  // Add new segment
  const addNewSegment = () => {
    const newSegment = {
      time: "0:00",
      text: ""
    };
    setTranslationSegments([...translationSegments, newSegment]);
  };

  // Delete segment
  const deleteSegment = (index: number) => {
    const updatedSegments = translationSegments.filter((_, i) => i !== index);
    setTranslationSegments(updatedSegments);
  };

  // Convert time format (e.g., "0:00" to "00:00:00,000")
  const convertToSRTTime = (timeStr: string): string => {
    if (timeStr.includes(',')) return timeStr; // Already in SRT format
    
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},000`;
    }
    return "00:00:00,000";
  };

  // Convert segments to SRT format
  const getSRTFromSegments = (segments: TranscriptSegment[], isArabic = false): string => {
    return segments
      .filter(segment => segment.text.trim())
      .map((segment, index) => {
        const startTime = convertToSRTTime(segment.time);
        // Calculate end time: use next segment's time or add 5 seconds
        const nextSegment = segments[index + 1];
        const endTime = nextSegment ? convertToSRTTime(nextSegment.time) : startTime;
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}`;
      })
      .join('\n\n');
  };

  // Convert SRT time to simple format (e.g., "00:01:23,000" to "1:23")
  const convertFromSRTTime = (srtTime: string): string => {
    const timePart = srtTime.split(',')[0]; // Remove milliseconds
    const [hours, minutes, seconds] = timePart.split(':');
    
    // If hours is 00, return minutes:seconds format
    if (hours === '00') {
      return `${parseInt(minutes)}:${seconds}`;
    }
    return `${parseInt(hours)}:${minutes}:${seconds}`;
  };

  // Convert SRT format to segments
  const getSegmentsFromSRT = (srtText: string): TranscriptSegment[] => {
    if (!srtText.trim()) return [];
    
    const blocks = srtText.trim().split(/\n\s*\n/);
    const segments: TranscriptSegment[] = [];
    
    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          const startTime = convertFromSRTTime(timeMatch[1]); // Convert to simple format
          const text = lines.slice(2).join('\n');
          segments.push({
            time: startTime,
            text: text
          });
        }
      }
    });
    
    return segments;
  };

  // Save translation mutation
  const saveTranslationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideoId || !selectedLanguage) return;
      
      // Convert segments to the format expected by the database (JSONB array)
      const contentForSave = translationSegments.map(segment => ({
        time: segment.time,
        text: segment.text
      }));
      
      if (selectedTranscript) {
        // Update existing transcript
        await apiRequest('PATCH', `/api/videos/${selectedVideoId}/transcripts/${selectedTranscript.id}`, {
          content: contentForSave
        });
      } else {
        // Create new transcript
        await apiRequest('POST', `/api/videos/${selectedVideoId}/transcripts`, {
          language: selectedLanguage,
          content: contentForSave
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideoId, "transcripts"] });
      toast({
        title: "Success",
        description: "Translation saved successfully",
        variant: "default",
      });
      setSaving(false);
    },
    onError: (error) => {
      console.error('Translation save error:', error);
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
        description: "Failed to save translation",
        variant: "destructive",
      });
      setSaving(false);
    },
  });

  const handleSaveTranslation = () => {
    if (!selectedVideoId || !selectedLanguage) {
      toast({
        title: "Error",
        description: "Please select a video and language",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    saveTranslationMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-6">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !['admin', 'editor'].includes(currentUser?.role)) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center">
                <Languages size={28} className="mr-3 text-primary" />
                Translations
              </h1>
              <p className="text-muted-foreground mt-2">
                Compare Arabic transcripts with translations and edit them
              </p>
            </div>
          </div>

          {/* Selection Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Select Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Video</label>
                  <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
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

                <div>
                  <label className="text-sm font-medium mb-2 block">Translation Language</label>
                  <Select 
                    value={selectedLanguage} 
                    onValueChange={setSelectedLanguage}
                    disabled={!selectedVideoId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="tr">Turkish</SelectItem>
                      <SelectItem value="ms">Malay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedVideoId && selectedLanguage && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    Video: {videos.find(v => v.id.toString() === selectedVideoId)?.title}
                  </Badge>
                  <Badge variant="outline">
                    Language: {getLanguageName(selectedLanguage)}
                  </Badge>
                  {selectedTranscript && (
                    <Badge variant="secondary">Existing Translation</Badge>
                  )}
                  {!selectedTranscript && (
                    <Badge variant="outline">New Translation</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* View Mode Toggle */}
          {selectedVideoId && selectedLanguage && (
            <Card>
              <CardHeader>
                <CardTitle>View Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <Button
                    variant={viewMode === 'segments' ? 'default' : 'outline'}
                    onClick={() => setViewMode('segments')}
                    size="sm"
                  >
                    Segment View
                  </Button>
                  <Button
                    variant={viewMode === 'text' ? 'default' : 'outline'}
                    onClick={() => setViewMode('text')}
                    size="sm"
                  >
                    SRT View
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Translation Interface */}
          {selectedVideoId && selectedLanguage && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Arabic Reference (Read-only) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Languages size={20} className="mr-2" />
                    Arabic Reference
                    <Badge variant="secondary" className="ml-2">Read-only</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === 'segments' ? (
                    <div className="max-h-[500px] overflow-y-auto space-y-3">
                      {arabicSegments.length > 0 ? (
                        arabicSegments.map((segment, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center mb-2">
                              <Clock size={14} className="mr-2 text-muted-foreground" />
                              <span className="text-sm font-mono text-muted-foreground">
                                {segment.time}
                              </span>
                            </div>
                            <div 
                              className="text-sm leading-relaxed"
                              style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'Arial, sans-serif' }}
                            >
                              {segment.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          No Arabic transcript available
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      <div 
                        className="p-3 text-sm font-mono leading-relaxed whitespace-pre-wrap bg-muted/20 rounded"
                        style={{ direction: 'ltr', textAlign: 'left' }}
                      >
                        {getSRTFromSegments(arabicSegments, true)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Translation Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Languages size={20} className="mr-2" />
                      {getLanguageName(selectedLanguage)} Translation
                    </div>
                    {viewMode === 'segments' && (
                      <Button onClick={addNewSegment} size="sm" variant="outline">
                        <Plus size={16} className="mr-1" />
                        Add Segment
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === 'segments' ? (
                    <div className="max-h-[500px] overflow-y-auto space-y-3">
                      {translationSegments.length > 0 ? (
                        translationSegments.map((segment, index) => (
                          <div
                            key={index}
                            className="flex space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors border-l-4 border-transparent hover:border-blue-200"
                          >
                            <div className="flex flex-col space-y-2 w-20 flex-shrink-0">
                              <div className="flex items-center space-x-1">
                                <Clock size={12} className="text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Time</span>
                              </div>
                              <input
                                type="text"
                                value={segment.time}
                                onChange={(e) => {
                                  const updatedSegments = [...translationSegments];
                                  updatedSegments[index] = { ...updatedSegments[index], time: e.target.value };
                                  setTranslationSegments(updatedSegments);
                                }}
                                className="text-xs h-8 text-center font-mono border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                                placeholder="0:00"
                              />
                              <button className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
                                Jump to
                              </button>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Translation Text</span>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addNewSegment()}
                                    className="h-6 px-2"
                                  >
                                    <Plus size={12} className="text-green-600" />
                                  </Button>
                                  {translationSegments.length > 1 && (
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
                              </div>
                              <Textarea
                                value={segment.text}
                                onChange={(e) => handleSegmentTextChange(index, e.target.value)}
                                placeholder={`Enter ${getLanguageName(selectedLanguage)} translation...`}
                                className="text-sm min-h-[60px] resize-none border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <Button onClick={addNewSegment} variant="outline">
                            <Plus size={16} className="mr-2" />
                            Add First Segment
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      <Textarea
                        value={getSRTFromSegments(translationSegments)}
                        onChange={(e) => {
                          const newSegments = getSegmentsFromSRT(e.target.value);
                          setTranslationSegments(newSegments);
                        }}
                        placeholder={`Enter ${getLanguageName(selectedLanguage)} translation in SRT format:

1
00:00:01,000 --> 00:00:01,000
Your translation text here

2
00:00:05,000 --> 00:00:05,000
Next segment translation...`}
                        className="min-h-[400px] resize-none text-sm font-mono"
                      />
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      {translationSegments.filter(s => s.text.trim()).length} of {translationSegments.length} segments with content
                    </div>
                    <Button
                      onClick={handleSaveTranslation}
                      disabled={saving || translationSegments.every(s => !s.text.trim())}
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? "Saving..." : "Save Translation"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!selectedVideoId && (
            <Card>
              <CardContent className="text-center py-12">
                <Languages size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Start Translating</h3>
                <p className="text-muted-foreground">
                  Select a video and language above to begin comparing and editing translations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}