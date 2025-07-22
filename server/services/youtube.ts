interface YouTubeVideoDetails {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnailUrl: string;
}

export class YouTubeService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || "";
  }

  extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
    if (!this.apiKey) {
      throw new Error("YouTube API key not configured");
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${this.apiKey}&part=snippet,contentDetails`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return null;
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;

      return {
        id: videoId,
        title: snippet.title,
        description: snippet.description || "",
        duration: this.parseDuration(contentDetails.duration),
        thumbnailUrl: snippet.thumbnails?.maxres?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url || "",
      };
    } catch (error) {
      console.error("Error fetching YouTube video details:", error);
      throw error;
    }
  }

  private parseDuration(duration: string): string {
    // Convert ISO 8601 duration (PT4M13S) to readable format (4:13)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "0:00";

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}

export const youtubeService = new YouTubeService();
