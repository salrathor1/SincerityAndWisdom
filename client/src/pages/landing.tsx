import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, FileText, List, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Video className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">TranscriptHub</h1>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Manage your YouTube video transcripts with ease. Store, edit, and sync transcripts across multiple languages.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Video className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Video Management</CardTitle>
              <CardDescription>
                Import and organize your YouTube videos with automatic metadata fetching
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Multi-Language Transcripts</CardTitle>
              <CardDescription>
                Create and manage transcripts in multiple languages with real-time editing
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <List className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Playlist Organization</CardTitle>
              <CardDescription>
                Organize your videos into playlists for better content management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-primary mb-2" />
              <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
              <CardDescription>
                Track your content with comprehensive analytics and insights
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to get started?</CardTitle>
              <CardDescription>
                Access your admin panel to manage your YouTube transcripts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleLogin} size="lg" className="w-full">
                Login to Admin Panel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
