import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { youtubeService } from "./services/youtube";
import { srtService } from "./services/srt";
import { insertVideoSchema, insertPlaylistSchema, insertTranscriptSchema } from "@shared/schema";
import { z } from "zod";

// Role-based authentication middleware
const requireRole = (roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      console.log('Role check for user:', userId);
      
      if (!userId) {
        console.log('No user ID found');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        console.log('User not found in database:', userId);
        return res.status(401).json({ message: "User not found" });
      }

      console.log('User role check:', { userId, userRole: user.role, requiredRoles: roles });
      
      if (!roles.includes(user.role || 'viewer')) {
        console.log('Insufficient permissions:', { userRole: user.role, requiredRoles: roles });
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      req.currentUser = user;
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ message: "Authorization error" });
    }
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Public playlist routes (for landing page)
  app.get('/api/playlists', async (req, res) => {
    try {
      const playlists = await storage.getPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists" });
    }
  });

  // Get videos in a playlist (public endpoint)
  app.get('/api/playlists/:id/videos', async (req, res) => {
    try {
      const playlistId = parseInt(req.params.id);
      const videos = await storage.getVideosByPlaylist(playlistId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching playlist videos:", error);
      res.status(500).json({ message: "Failed to fetch playlist videos" });
    }
  });

  // Public video transcripts endpoint
  app.get('/api/videos/:id/transcripts', async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const transcripts = await storage.getTranscriptsByVideo(videoId);
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      res.status(500).json({ message: "Failed to fetch transcripts" });
    }
  });

  // User management routes (admin only)
  app.get('/api/admin/users', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id/role', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;
      
      console.log('Role update request:', { userId, role, currentUser: req.currentUser?.id });
      
      if (!['admin', 'arabic_transcripts_editor', 'translations_editor', 'viewer'].includes(role)) {
        console.log('Invalid role provided:', role);
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      console.log('Role updated successfully:', { userId, newRole: role });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.post('/api/playlists', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const playlistData = insertPlaylistSchema.parse(req.body);
      const playlist = await storage.createPlaylist(playlistData);
      res.json(playlist);
    } catch (error) {
      console.error("Error creating playlist:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid playlist data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  app.get('/api/playlists/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playlist = await storage.getPlaylist(id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      res.json(playlist);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      res.status(500).json({ message: "Failed to fetch playlist" });
    }
  });

  app.put('/api/playlists/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playlistData = insertPlaylistSchema.partial().parse(req.body);
      const playlist = await storage.updatePlaylist(id, playlistData);
      res.json(playlist);
    } catch (error) {
      console.error("Error updating playlist:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid playlist data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update playlist" });
    }
  });

  app.delete('/api/playlists/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlaylist(id);
      res.json({ message: "Playlist deleted successfully" });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });

  // Video routes
  app.get('/api/videos', isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const videos = await storage.getVideos(limit);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.post('/api/videos', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const { youtubeUrl, playlistId, languages } = req.body;
      
      if (!youtubeUrl) {
        return res.status(400).json({ message: "YouTube URL is required" });
      }

      const youtubeId = youtubeService.extractVideoId(youtubeUrl);
      if (!youtubeId) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Check if video already exists
      const existingVideo = await storage.getVideoByYoutubeId(youtubeId);
      if (existingVideo) {
        return res.status(409).json({ message: "Video already exists" });
      }

      // Fetch video details from YouTube API
      const videoDetails = await youtubeService.getVideoDetails(youtubeId);
      if (!videoDetails) {
        return res.status(404).json({ message: "Video not found on YouTube" });
      }

      const videoData = insertVideoSchema.parse({
        youtubeId,
        title: videoDetails.title,
        description: videoDetails.description,
        duration: videoDetails.duration,
        thumbnailUrl: videoDetails.thumbnailUrl,
        youtubeUrl,
        playlistId: playlistId || null,
        status: "complete",
      });

      const video = await storage.createVideo(videoData);

      // Create empty transcripts for requested languages
      if (languages && Array.isArray(languages)) {
        for (const language of languages) {
          await storage.createTranscript({
            videoId: video.id,
            language,
            content: [],
            isAutoGenerated: false,
          });
        }
      }

      res.json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.get('/api/videos/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const video = await storage.getVideo(id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.put('/api/videos/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const requestData = req.body;
      
      // Handle YouTube ID updates
      if (requestData.youtubeId) {
        // Check if the new YouTube ID is different and valid
        const currentVideo = await storage.getVideo(id);
        if (!currentVideo) {
          return res.status(404).json({ message: "Video not found" });
        }
        
        if (requestData.youtubeId !== currentVideo.youtubeId) {
          // Check if another video already uses this YouTube ID
          const existingVideo = await storage.getVideoByYoutubeId(requestData.youtubeId);
          if (existingVideo && existingVideo.id !== id) {
            return res.status(409).json({ message: "Another video already uses this YouTube ID" });
          }
          
          // Fetch updated video details from YouTube API
          const videoDetails = await youtubeService.getVideoDetails(requestData.youtubeId);
          if (!videoDetails) {
            return res.status(404).json({ message: "Video not found on YouTube" });
          }
          
          // Update with new YouTube data
          const updatedData = {
            youtubeId: requestData.youtubeId,
            title: videoDetails.title,
            description: videoDetails.description,
            duration: videoDetails.duration,
            thumbnailUrl: videoDetails.thumbnailUrl,
            youtubeUrl: `https://www.youtube.com/watch?v=${requestData.youtubeId}`,
            status: "complete",
          };
          
          const video = await storage.updateVideo(id, updatedData);
          return res.json(video);
        }
      }
      
      // Handle playlist order updates specifically
      if (requestData.playlistOrder !== undefined) {
        const video = await storage.updateVideoOrder(id, requestData.playlistOrder);
        return res.json(video);
      }
      
      // Regular update for other fields
      const videoData = insertVideoSchema.partial().parse(requestData);
      const video = await storage.updateVideo(id, videoData);
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete('/api/videos/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVideo(id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Transcript routes
  app.get('/api/videos/:videoId/transcripts', isAuthenticated, async (req, res) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const transcripts = await storage.getTranscripts(videoId);
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      res.status(500).json({ message: "Failed to fetch transcripts" });
    }
  });

  app.post('/api/videos/:videoId/transcripts', isAuthenticated, requireRole(['admin', 'arabic_transcripts_editor', 'translations_editor']), async (req, res) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const transcriptData = insertTranscriptSchema.parse({
        ...req.body,
        videoId,
      });
      const transcript = await storage.createTranscript(transcriptData);
      res.json(transcript);
    } catch (error) {
      console.error("Error creating transcript:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transcript data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create transcript" });
    }
  });

  app.get('/api/transcripts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcript = await storage.getTranscript(id);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }
      res.json(transcript);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ message: "Failed to fetch transcript" });
    }
  });

  app.put('/api/transcripts/:id', isAuthenticated, requireRole(['admin', 'arabic_transcripts_editor', 'translations_editor']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcriptData = insertTranscriptSchema.partial().parse(req.body);
      const transcript = await storage.updateTranscript(id, transcriptData);
      res.json(transcript);
    } catch (error) {
      console.error("Error updating transcript:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transcript data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update transcript" });
    }
  });

  app.delete('/api/transcripts/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTranscript(id);
      res.json({ message: "Transcript deleted successfully" });
    } catch (error) {
      console.error("Error deleting transcript:", error);
      res.status(500).json({ message: "Failed to delete transcript" });
    }
  });

  // Draft routes
  app.put('/api/transcripts/:id/draft', isAuthenticated, requireRole(['admin', 'arabic_transcripts_editor']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Draft content is required" });
      }

      const transcript = await storage.updateTranscriptDraft(id, content);
      res.json(transcript);
    } catch (error) {
      console.error("Error saving draft:", error);
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  app.post('/api/transcripts/:id/publish', isAuthenticated, requireRole(['admin', 'arabic_transcripts_editor']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcript = await storage.publishTranscriptDraft(id);
      res.json(transcript);
    } catch (error) {
      console.error("Error publishing draft:", error);
      res.status(500).json({ message: error.message || "Failed to publish draft" });
    }
  });

  // SRT Import route
  app.post('/api/transcripts/:id/import-srt', isAuthenticated, requireRole(['admin', 'arabic_transcripts_editor', 'translations_editor']), async (req, res) => {
    try {
      const transcriptId = parseInt(req.params.id);
      const { srtContent } = req.body;
      
      if (!srtContent) {
        return res.status(400).json({ message: "SRT content is required" });
      }

      // Validate SRT format
      const validation = srtService.validateSRT(srtContent);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }

      // Parse SRT content
      const segments = srtService.parseSRT(srtContent);
      if (segments.length === 0) {
        return res.status(400).json({ message: "No valid subtitle segments found in SRT file" });
      }

      // Update transcript with parsed content
      const transcript = await storage.updateTranscript(transcriptId, {
        content: segments,
      });

      res.json({ 
        message: "SRT file imported successfully",
        segmentsCount: segments.length,
        transcript 
      });
    } catch (error) {
      console.error("Error importing SRT:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transcript data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to import SRT file" });
    }
  });

  // Tasks routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.query.userId as string;
      const status = req.query.status as string;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      // Admins can see all tasks, others only see their assigned tasks
      const filteredUserId = currentUser?.role === 'admin' ? userId : currentUserId;
      
      const tasks = await storage.getTasks(filteredUserId, status);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      // Only admins can create tasks
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create tasks" });
      }

      const task = await storage.createTask({
        ...req.body,
        createdByUserId: currentUserId,
      });
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      const existingTask = await storage.getTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Admins can update any task, users can only update status of their own tasks
      if (currentUser?.role !== 'admin' && existingTask.assignedToUserId !== currentUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If user is not admin, they can only update status
      const updateData = currentUser?.role === 'admin' ? req.body : { status: req.body.status };

      const task = await storage.updateTask(id, updateData);
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      // Only admins can delete tasks
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete tasks" });
      }

      await storage.deleteTask(id);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
