interface TranscriptSegment {
  time: string;
  text: string;
}

export class SRTService {
  /**
   * Parse SRT content and convert to transcript segments
   */
  parseSRT(srtContent: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    
    // Split by double newlines to separate subtitle blocks
    const blocks = srtContent.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      
      // Skip if block doesn't have at least 3 lines (index, timestamp, text)
      if (lines.length < 3) continue;
      
      // Line 0: Index number (we ignore this)
      // Line 1: Timestamp
      // Line 2+: Text content
      
      const timestamp = lines[1];
      const text = lines.slice(2).join(' ').trim();
      
      // Parse timestamp (format: 00:00:20,000 --> 00:00:24,000)
      const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2}),\d{3}/);
      if (timeMatch) {
        const startTime = this.formatTime(timeMatch[1]);
        
        if (startTime && text) {
          segments.push({
            time: startTime,
            text: this.cleanText(text)
          });
        }
      }
    }
    
    return segments;
  }
  
  /**
   * Format time from HH:MM:SS to M:SS or MM:SS format
   */
  private formatTime(timeString: string): string {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes === 0) {
      return `0:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${totalMinutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Clean subtitle text by removing HTML tags and extra formatting
   */
  private cleanText(text: string): string {
    return text
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common subtitle formatting
      .replace(/\{[^}]*\}/g, '')
      .replace(/\[[^\]]*\]/g, '')
      // Trim
      .trim();
  }
  
  /**
   * Validate SRT content format
   */
  validateSRT(srtContent: string): { isValid: boolean; error?: string } {
    if (!srtContent || srtContent.trim().length === 0) {
      return { isValid: false, error: "SRT content is empty" };
    }
    
    // Check if it contains timestamp patterns
    const timestampPattern = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
    if (!timestampPattern.test(srtContent)) {
      return { isValid: false, error: "Invalid SRT format - no valid timestamps found" };
    }
    
    return { isValid: true };
  }
}

export const srtService = new SRTService();