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
import { Languages, Save, Play, Pause } from "lucide-react";

export default function TranslationsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [translationText, setTranslationText] = useState<string>("");
  const [saving, setSaving] = useState(false);

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
  const arabicTranscript = transcripts.find(t => t.language === 'arabic');
  
  // Get available translation languages (excluding Arabic)
  const availableLanguages = transcripts
    .filter(t => t.language !== 'arabic')
    .map(t => t.language);

  // Get selected language transcript
  const selectedTranscript = transcripts.find(t => t.language === selectedLanguage);

  // Update translation text when transcript changes
  useEffect(() => {
    if (selectedTranscript) {
      setTranslationText(selectedTranscript.content || "");
    } else {
      setTranslationText("");
    }
  }, [selectedTranscript]);

  // Save translation mutation
  const saveTranslationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideoId || !selectedLanguage) return;
      
      if (selectedTranscript) {
        // Update existing transcript
        await apiRequest('PATCH', `/api/videos/${selectedVideoId}/transcripts/${selectedTranscript.id}`, {
          content: translationText
        });
      } else {
        // Create new transcript
        await apiRequest('POST', `/api/videos/${selectedVideoId}/transcripts`, {
          language: selectedLanguage,
          content: translationText
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
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="urdu">Urdu</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="turkish">Turkish</SelectItem>
                      <SelectItem value="malay">Malay</SelectItem>
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
                    Language: {selectedLanguage}
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
                  <Textarea
                    value={arabicTranscript?.content || "No Arabic transcript available"}
                    readOnly
                    className="min-h-[400px] bg-muted/50 resize-none"
                    style={{ direction: 'rtl', textAlign: 'right' }}
                  />
                </CardContent>
              </Card>

              {/* Translation Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Languages size={20} className="mr-2" />
                      {selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Translation
                    </div>
                    <Button
                      onClick={handleSaveTranslation}
                      disabled={saving || !translationText.trim()}
                      size="sm"
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={translationText}
                    onChange={(e) => setTranslationText(e.target.value)}
                    placeholder={`Enter ${selectedLanguage} translation here...`}
                    className="min-h-[400px] resize-none"
                  />
                  <div className="mt-4 text-sm text-muted-foreground">
                    {translationText.length} characters
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