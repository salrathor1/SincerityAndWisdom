import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Play, Pause, SkipBack, SkipForward, Volume2, Save } from "lucide-react";

interface TranscriptSegment {
  time: string;
  text: string;
}

interface TranscriptEditorProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
}

export function TranscriptEditor({ video, isOpen, onClose }: TranscriptEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration] = useState(video?.duration || "15:42");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  const { data: transcripts } = useQuery({
    queryKey: ["/api/videos", video?.id, "transcripts"],
    enabled: isOpen && !!video?.id,
  });

  useEffect(() => {
    if (transcripts && transcripts.length > 0) {
      const transcript = transcripts.find((t: any) => t.language === selectedLanguage);
      if (transcript && transcript.content) {
        setSegments(Array.isArray(transcript.content) ? transcript.content : []);
      } else {
        // Create empty transcript structure
        setSegments([
          { time: "0:00", text: "Click here to add your first transcript segment..." },
        ]);
      }
    }
  }, [transcripts, selectedLanguage]);

  const updateTranscriptMutation = useMutation({
    mutationFn: async (content: TranscriptSegment[]) => {
      const transcript = transcripts?.find((t: any) => t.language === selectedLanguage);
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

  const handleSave = () => {
    updateTranscriptMutation.mutate(segments);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // Here you would integrate with a video player library like ReactPlayer
  };

  const handleSeekBack = () => {
    // Implement seek back 10 seconds
    toast({
      description: "Seeked back 10 seconds",
    });
  };

  const handleSeekForward = () => {
    // Implement seek forward 10 seconds
    toast({
      description: "Seeked forward 10 seconds",
    });
  };

  const handleSegmentClick = (index: number, time: string) => {
    setActiveSegmentIndex(index);
    setCurrentTime(time);
    // Here you would seek the video player to this time
    toast({
      description: `Jumped to ${time}`,
    });
  };

  const handleTextEdit = (index: number, newText: string) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], text: newText };
    setSegments(newSegments);
  };

  const addNewSegment = () => {
    const newSegments = [...segments];
    newSegments.push({
      time: currentTime,
      text: "New transcript segment...",
    });
    setSegments(newSegments);
  };

  const availableLanguages = [
    { code: "en", name: "English" },
    { code: "ar", name: "Arabic" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
  ];

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Edit Transcript - {video.title}
            </DialogTitle>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-muted-foreground">Language:</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Video Player */}
          <div className="w-1/2 p-6 border-r">
            <div className="aspect-video bg-slate-900 rounded-lg mb-4 relative overflow-hidden">
              <img
                src={video.thumbnailUrl || "/placeholder-video.jpg"}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                <Button
                  size="lg"
                  className="w-16 h-16 rounded-full"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </Button>
              </div>
            </div>

            {/* Video Controls */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: "35%" }}></div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentTime} / {duration}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={handleSeekBack}>
                  <SkipBack size={16} className="mr-1" />
                  10s
                </Button>
                <Button variant="outline" size="sm" onClick={handleSeekForward}>
                  10s
                  <SkipForward size={16} className="ml-1" />
                </Button>
                <div className="flex items-center space-x-2 ml-auto">
                  <Volume2 size={16} className="text-muted-foreground" />
                  <div className="w-20 bg-slate-200 rounded-full h-2">
                    <div className="bg-slate-600 rounded-full h-2" style={{ width: "70%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Editor */}
          <div className="w-1/2 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">Transcript</h4>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={addNewSegment}>
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
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {segments.length > 0 ? (
                segments.map((segment, index) => (
                  <div
                    key={index}
                    className={`flex space-x-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors ${
                      index === activeSegmentIndex ? "bg-blue-50 border-l-4 border-primary" : ""
                    }`}
                    onClick={() => handleSegmentClick(index, segment.time)}
                  >
                    <div className="text-sm text-muted-foreground w-16 flex-shrink-0 pt-1">
                      {segment.time}
                    </div>
                    <div className="flex-1">
                      <div
                        className="text-sm text-foreground editable-content p-2 rounded border-transparent border hover:border-border focus:border-primary"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleTextEdit(index, e.currentTarget.textContent || "")}
                        dangerouslySetInnerHTML={{ __html: segment.text }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No transcript segments yet.</p>
                  <Button className="mt-4" onClick={addNewSegment}>
                    Add First Segment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
