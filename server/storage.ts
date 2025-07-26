import {
  users,
  playlists,
  videos,
  transcripts,
  type User,
  type UpsertUser,
  type Playlist,
  type InsertPlaylist,
  type Video,
  type InsertVideo,
  type VideoWithRelations,
  type Transcript,
  type InsertTranscript,
  type PlaylistWithVideos,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, asc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: 'admin' | 'editor' | 'viewer'): Promise<User>;
  
  // Playlist operations
  createPlaylist(playlist: InsertPlaylist): Promise<Playlist>;
  getPlaylists(): Promise<PlaylistWithVideos[]>;
  getPlaylist(id: number): Promise<PlaylistWithVideos | undefined>;
  updatePlaylist(id: number, playlist: Partial<InsertPlaylist>): Promise<Playlist>;
  deletePlaylist(id: number): Promise<void>;
  
  // Video operations
  createVideo(video: InsertVideo): Promise<Video>;
  getVideos(limit?: number): Promise<VideoWithRelations[]>;
  getVideo(id: number): Promise<VideoWithRelations | undefined>;
  getVideoByYoutubeId(youtubeId: string): Promise<VideoWithRelations | undefined>;
  getVideosByPlaylist(playlistId: number): Promise<VideoWithRelations[]>;
  updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video>;
  updateVideoOrder(id: number, playlistOrder: number): Promise<Video>;
  deleteVideo(id: number): Promise<void>;
  
  // Transcript operations
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscripts(videoId: number): Promise<Transcript[]>;
  getTranscriptsByVideo(videoId: number): Promise<Transcript[]>;
  getTranscript(id: number): Promise<Transcript | undefined>;
  updateTranscript(id: number, transcript: Partial<InsertTranscript>): Promise<Transcript>;
  deleteTranscript(id: number): Promise<void>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalVideos: number;
    totalTranscripts: number;
    totalLanguages: number;
    totalPlaylists: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: 'admin' | 'editor' | 'viewer'): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Playlist operations
  async createPlaylist(playlist: InsertPlaylist): Promise<Playlist> {
    const [created] = await db.insert(playlists).values(playlist).returning();
    return created;
  }

  async getPlaylists(): Promise<PlaylistWithVideos[]> {
    return await db.query.playlists.findMany({
      with: {
        videos: true,
      },
      orderBy: [desc(playlists.createdAt)],
    });
  }

  async getPlaylist(id: number): Promise<PlaylistWithVideos | undefined> {
    return await db.query.playlists.findFirst({
      where: eq(playlists.id, id),
      with: {
        videos: true,
      },
    });
  }

  async updatePlaylist(id: number, playlist: Partial<InsertPlaylist>): Promise<Playlist> {
    const [updated] = await db
      .update(playlists)
      .set({ ...playlist, updatedAt: new Date() })
      .where(eq(playlists.id, id))
      .returning();
    return updated;
  }

  async deletePlaylist(id: number): Promise<void> {
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  // Video operations
  async createVideo(video: InsertVideo): Promise<Video> {
    const [created] = await db.insert(videos).values(video).returning();
    return created;
  }

  async getVideos(limit = 100): Promise<VideoWithRelations[]> {
    return await db.query.videos.findMany({
      with: {
        playlist: true,
        transcripts: true,
      },
      orderBy: [desc(videos.createdAt)],
      limit,
    });
  }

  async getVideo(id: number): Promise<VideoWithRelations | undefined> {
    return await db.query.videos.findFirst({
      where: eq(videos.id, id),
      with: {
        playlist: true,
        transcripts: true,
      },
    });
  }

  async getVideoByYoutubeId(youtubeId: string): Promise<VideoWithRelations | undefined> {
    return await db.query.videos.findFirst({
      where: eq(videos.youtubeId, youtubeId),
      with: {
        playlist: true,
        transcripts: true,
      },
    });
  }

  async updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video> {
    const [updated] = await db
      .update(videos)
      .set({ ...video, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updated;
  }

  async updateVideoOrder(id: number, playlistOrder: number): Promise<Video> {
    const [updated] = await db
      .update(videos)
      .set({ playlistOrder, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updated;
  }

  async getVideosByPlaylist(playlistId: number): Promise<VideoWithRelations[]> {
    return await db.query.videos.findMany({
      where: eq(videos.playlistId, playlistId),
      with: {
        playlist: true,
        transcripts: true,
      },
      orderBy: [asc(videos.playlistOrder), desc(videos.createdAt)],
    });
  }

  async deleteVideo(id: number): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
  }

  // Transcript operations
  async createTranscript(transcript: InsertTranscript): Promise<Transcript> {
    const [created] = await db.insert(transcripts).values(transcript).returning();
    return created;
  }

  async getTranscripts(videoId: number): Promise<Transcript[]> {
    return await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.videoId, videoId))
      .orderBy(transcripts.language);
  }

  async getTranscriptsByVideo(videoId: number): Promise<Transcript[]> {
    return await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.videoId, videoId))
      .orderBy(transcripts.language);
  }

  async getTranscript(id: number): Promise<Transcript | undefined> {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, id));
    return transcript;
  }

  async updateTranscript(id: number, transcript: Partial<InsertTranscript>): Promise<Transcript> {
    const [updated] = await db
      .update(transcripts)
      .set({ ...transcript, updatedAt: new Date() })
      .where(eq(transcripts.id, id))
      .returning();
    return updated;
  }

  async updateTranscriptDraft(id: number, draftContent: any): Promise<Transcript> {
    const [updated] = await db
      .update(transcripts)
      .set({ draftContent, updatedAt: new Date() })
      .where(eq(transcripts.id, id))
      .returning();
    return updated;
  }

  async publishTranscriptDraft(id: number): Promise<Transcript> {
    // Move draft content to published content
    const transcript = await this.getTranscript(id);
    if (!transcript || !transcript.draftContent) {
      throw new Error("No draft content found to publish");
    }
    
    const [updated] = await db
      .update(transcripts)
      .set({ 
        content: transcript.draftContent,
        updatedAt: new Date() 
      })
      .where(eq(transcripts.id, id))
      .returning();
    return updated;
  }

  async deleteTranscript(id: number): Promise<void> {
    await db.delete(transcripts).where(eq(transcripts.id, id));
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    totalVideos: number;
    totalTranscripts: number;
    totalLanguages: number;
    totalPlaylists: number;
  }> {
    const [videoCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(videos);
    
    const [transcriptCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcripts);
    
    const [languageCount] = await db
      .select({ count: sql<number>`count(distinct language)` })
      .from(transcripts);
    
    const [playlistCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playlists);

    return {
      totalVideos: Number(videoCount.count),
      totalTranscripts: Number(transcriptCount.count),
      totalLanguages: Number(languageCount.count),
      totalPlaylists: Number(playlistCount.count),
    };
  }
}

export const storage = new DatabaseStorage();
