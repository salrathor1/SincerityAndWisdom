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
import { Languages, Save, Clock, Plus, Trash2, Link, Download, Check, X } from "lucide-react";

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
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [translationSegments, setTranslationSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [srtTextContent, setSrtTextContent] = useState("");
  const [viewMode, setViewMode] = useState<'segments' | 'text'>('segments');
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);

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

    if (!isLoading && isAuthenticated && !['admin', 'translations_editor'].includes(currentUser?.role)) {
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

  // Handle URL parameters for video and language selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdParam = urlParams.get('videoId');
    const languageParam = urlParams.get('language');
    
    if (videoIdParam && videos.length > 0) {
      const videoExists = videos.find(v => v.id.toString() === videoIdParam);
      if (videoExists) {
        setSelectedVideoId(videoIdParam);
      }
    }
    
    if (languageParam) {
      const validLanguages = ['en', 'ur', 'fr', 'es', 'tr', 'ms'];
      if (validLanguages.includes(languageParam)) {
        setSelectedLanguage(languageParam);
      }
    }
  }, [videos]);

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
      setSrtTextContent(getSRTFromSegments(segments));
    } else {
      // Initialize with empty array - user can create their own segments
      setTranslationSegments([]);
      setSrtTextContent("");
    }
  }, [selectedTranscript]);

  // Update SRT content when switching to SRT view mode
  useEffect(() => {
    if (viewMode === 'text' && translationSegments.length > 0) {
      setSrtTextContent(getSRTFromSegments(translationSegments));
    }
  }, [viewMode]);

  // Handle segment text updates
  const handleSegmentTextChange = (index: number, newText: string) => {
    const updatedSegments = [...translationSegments];
    updatedSegments[index] = { ...updatedSegments[index], text: newText };
    setTranslationSegments(updatedSegments);
  };

  // Add new segment at the end
  const addNewSegment = () => {
    const newSegment = {
      time: "0:00",
      text: ""
    };
    setTranslationSegments([...translationSegments, newSegment]);
  };

  // Add new segment after a specific index
  const addSegmentAfter = (index: number) => {
    const newSegment = {
      time: "0:00",
      text: ""
    };
    const newSegments = [...translationSegments];
    newSegments.splice(index + 1, 0, newSegment);
    setTranslationSegments(newSegments);
  };

  // Handle SRT text changes (similar to transcript editor)
  const handleSRTTextChange = (text: string) => {
    setSrtTextContent(text);
    updateSegmentsFromSRT(text);
  };

  // Update segments from SRT text (similar to transcript editor)
  const updateSegmentsFromSRT = (text: string) => {
    // Parse SRT format
    const srtBlocks = text.split('\n\n').filter(block => block.trim());
    
    if (srtBlocks.length === 0) {
      setTranslationSegments([{ time: "0:00", text: "" }]);
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
          const startTime = convertFromSRTTime(timeMatch[1]);
          const text = textLines.join('\n');
          newSegments.push({ time: startTime, text });
        }
      } else if (lines.length === 1) {
        // Simple text line - use existing timestamp or default
        newSegments.push({
          time: translationSegments[newSegments.length]?.time || "0:00",
          text: lines[0],
        });
      }
    }
    
    if (newSegments.length === 0) {
      setTranslationSegments([{ time: "0:00", text: "" }]);
    } else {
      setTranslationSegments(newSegments);
    }
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
      console.log('Save mutation starting...', { selectedVideoId, selectedLanguage, segmentsCount: translationSegments.length });
      
      if (!selectedVideoId || !selectedLanguage) {
        throw new Error('Missing video ID or language');
      }
      
      // Convert segments to the format expected by the database (JSONB array)
      const contentForSave = translationSegments.map(segment => ({
        time: segment.time,
        text: segment.text
      }));
      
      console.log('Content to save:', contentForSave);
      
      if (selectedTranscript) {
        console.log('Updating existing transcript:', selectedTranscript.id);
        // Update existing transcript - use PUT endpoint like transcript editor
        await apiRequest('PUT', `/api/transcripts/${selectedTranscript.id}`, {
          content: contentForSave
        });
      } else {
        console.log('Creating new transcript for language:', selectedLanguage);
        // Create new transcript
        await apiRequest('POST', `/api/videos/${selectedVideoId}/transcripts`, {
          language: selectedLanguage,
          content: contentForSave
        });
      }
    },
    onSuccess: () => {
      console.log('Save mutation successful');
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
        description: `Failed to save translation: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setSaving(false);
    },
  });

  const handleSaveTranslation = () => {
    console.log('handleSaveTranslation called', { selectedVideoId, selectedLanguage, segmentsLength: translationSegments.length });
    
    if (!selectedVideoId || !selectedLanguage) {
      toast({
        title: "Error",
        description: "Please select a video and language",
        variant: "destructive",
      });
      return;
    }
    
    if (translationSegments.length === 0 || translationSegments.every(s => !s.text.trim())) {
      toast({
        title: "Error",
        description: "Please add some translation content before saving",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    saveTranslationMutation.mutate();
  };

  const generateCustomUrl = () => {
    if (!selectedVideoId || !selectedLanguage) {
      toast({
        title: "Error",
        description: "Please select a video and language first",
        variant: "destructive",
      });
      return;
    }

    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('videoId', selectedVideoId);
    params.set('language', selectedLanguage);
    
    const customUrl = `${baseUrl}/translations?${params.toString()}`;
    
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

  const downloadTranslationSRT = () => {
    if (!selectedVideoId || !selectedLanguage || translationSegments.length === 0) {
      toast({
        title: "Error",
        description: "No translation content to download",
        variant: "destructive",
      });
      return;
    }

    const video = videos.find(v => v.id.toString() === selectedVideoId);
    const videoTitle = video?.title || 'Unknown Video';
    
    // Generate SRT content from translation segments
    const srtContent = translationSegments
      .map((segment, index) => {
        if (!segment.text.trim()) return null;
        return `${index + 1}\n${segment.time} --> ${segment.time}\n${segment.text.trim()}\n`;
      })
      .filter(Boolean)
      .join('\n');

    if (!srtContent.trim()) {
      toast({
        title: "Error",
        description: "No translation content to download",
        variant: "destructive",
      });
      return;
    }

    // Create and download file
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${videoTitle}_${getLanguageName(selectedLanguage)}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Downloaded ${getLanguageName(selectedLanguage)} translation SRT file`,
    });
  };

  // Update approval status
  const updateApprovalStatusMutation = useMutation({
    mutationFn: async ({ transcriptId, approvalStatus, language }: { transcriptId: number, approvalStatus: string, language: string }) => {
      return apiRequest('PUT', `/api/transcripts/${transcriptId}/approval-status`, {
        approvalStatus,
        language
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos', selectedVideoId, 'transcripts'] });
      toast({
        title: "Success",
        description: "Approval status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update approval status",
        variant: "destructive",
      });
    },
  });

  const handleApprovalStatusUpdate = (approvalStatus: string) => {
    if (!selectedTranscript || !selectedLanguage) return;
    
    updateApprovalStatusMutation.mutate({
      transcriptId: selectedTranscript.id,
      approvalStatus,
      language: selectedLanguage,
    });
  };

  // Get language-specific approval status
  const getApprovalStatus = (transcript: any, language: string): string => {
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

  if (!isAuthenticated || !['admin', 'translations_editor'].includes(currentUser?.role)) {
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
            
            {selectedVideoId && selectedLanguage && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={generateCustomUrl}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Link size={16} />
                  Copy Custom URL
                </Button>
                
                {currentUser?.role === 'admin' && (
                  <Button
                    onClick={downloadTranslationSRT}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={translationSegments.length === 0 || translationSegments.every(s => !s.text.trim())}
                  >
                    <Download size={16} />
                    Download SRT
                  </Button>
                )}
              </div>
            )}
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
                  {selectedTranscript && selectedLanguage && (
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={getApprovalStatus(selectedTranscript, selectedLanguage) === 'approved' ? 'default' : 'destructive'}
                        className={`text-xs ${
                          getApprovalStatus(selectedTranscript, selectedLanguage) === 'approved' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        {getApprovalStatus(selectedTranscript, selectedLanguage) === 'approved' ? 'Checked' : 'Unchecked'}
                      </Badge>
                      
                      {currentUser?.role === 'admin' && (
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant={getApprovalStatus(selectedTranscript, selectedLanguage) === 'approved' ? 'default' : 'outline'}
                            onClick={() => handleApprovalStatusUpdate('approved')}
                            disabled={updateApprovalStatusMutation.isPending}
                            className="h-6 px-2 text-xs"
                          >
                            <Check size={12} className="mr-1" />
                            Check
                          </Button>
                          <Button
                            size="sm"
                            variant={getApprovalStatus(selectedTranscript, selectedLanguage) === 'unchecked' ? 'destructive' : 'outline'}
                            onClick={() => handleApprovalStatusUpdate('unchecked')}
                            disabled={updateApprovalStatusMutation.isPending}
                            className="h-6 px-2 text-xs"
                          >
                            <X size={12} className="mr-1" />
                            Unchecked
                          </Button>
                        </div>
                      )}
                    </div>
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
                          <div 
                            key={index} 
                            className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                              activeSegmentIndex === index 
                                ? 'bg-blue-50 border-blue-200 shadow-md' 
                                : 'bg-muted/30 hover:bg-muted/50 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              setActiveSegmentIndex(index);
                              // Scroll to corresponding translation segment if it exists
                              if (index < translationSegments.length) {
                                const translationElement = document.getElementById(`translation-segment-${index}`);
                                translationElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                          >
                            <div className="flex items-center mb-2">
                              <Clock size={14} className="mr-2 text-muted-foreground" />
                              <span className="text-sm font-mono text-muted-foreground">
                                {segment.time}
                              </span>
                              {activeSegmentIndex === index && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            <div 
                              className="text-sm leading-relaxed arabic-font"
                              style={{ direction: 'rtl', textAlign: 'right' }}
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
                        style={{ direction: 'rtl', textAlign: 'right' }}
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
                  <CardTitle className="flex items-center">
                    <Languages size={20} className="mr-2" />
                    {getLanguageName(selectedLanguage)} Translation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === 'segments' ? (
                    <div className="max-h-[500px] overflow-y-auto space-y-3">
                      {translationSegments.length > 0 ? (
                        translationSegments.map((segment, index) => (
                          <div
                            key={index}
                            id={`translation-segment-${index}`}
                            className={`border rounded-lg p-3 transition-all duration-200 ${
                              activeSegmentIndex === index
                                ? 'bg-blue-50 border-blue-200 shadow-md'
                                : 'bg-muted/30 hover:bg-muted/50 hover:border-gray-300'
                            }`}
                            onClick={() => setActiveSegmentIndex(index)}
                          >
                            <div className="flex items-center mb-2">
                              <Clock size={14} className="mr-2 text-muted-foreground" />
                              <span className="text-sm font-mono text-muted-foreground">
                                {segment.time}
                              </span>
                            </div>
                            <Textarea
                              value={segment.text}
                              onChange={(e) => handleSegmentTextChange(index, e.target.value)}
                              onFocus={() => setActiveSegmentIndex(index)}
                              placeholder={`Enter ${getLanguageName(selectedLanguage)} translation...`}
                              className="text-sm leading-relaxed resize-none border-none bg-transparent focus:outline-none focus:ring-0 p-0 min-h-[80px]"
                              style={{ height: 'auto' }}
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.max(80, target.scrollHeight) + 'px';
                              }}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          No translation segments available
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      <Textarea
                        value={srtTextContent}
                        onChange={(e) => handleSRTTextChange(e.target.value)}
                        placeholder={`Enter ${getLanguageName(selectedLanguage)} translation in SRT format:

1
00:00:01,000 --> 00:00:01,000
Your translation text here

2
00:00:05,000 --> 00:00:05,000
Next segment translation...`}
                        className="min-h-[400px] resize-none text-sm font-mono border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
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