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
      
      // Parse timestamp - handle both standard format (00:00:20,000 --> 00:00:24,000) 
      // and non-standard format (00:00:428,00:11:128)
      let startTimeStr = "";
      
      if (timestamp.includes('-->')) {
        // Standard SRT format: 00:00:20,000 --> 00:00:24,000
        const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2}),\d{1,3}/);
        if (timeMatch) {
          startTimeStr = timeMatch[1];
        }
      } else {
        // Non-standard format: 00:00:428,00:11:128 (start,end)
        const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{1,3}),/);
        if (timeMatch) {
          startTimeStr = timeMatch[1];
        }
      }
      
      if (startTimeStr) {
        const startTime = this.formatTime(startTimeStr);
        
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
   * Handles both standard (HH:MM:SS) and non-standard (HH:MM:SSS) formats
   */
  private formatTime(timeString: string): string {
    const parts = timeString.split(':');
    
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      let seconds = parts[2];
      
      // Handle non-standard format where seconds might have milliseconds appended (e.g., "428")
      if (seconds.length > 2) {
        // Extract just the seconds part (first 2 digits)
        seconds = seconds.substring(0, 2);
      }
      
      const totalMinutes = hours * 60 + minutes;
      const secondsNum = parseInt(seconds) || 0;
      
      if (totalMinutes === 0) {
        return `0:${secondsNum.toString().padStart(2, '0')}`;
      }
      
      return `${totalMinutes}:${secondsNum.toString().padStart(2, '0')}`;
    }
    
    // Fallback for unexpected formats
    return "0:00";
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
    
    // Check if it contains timestamp patterns (standard or non-standard format)
    const standardTimestampPattern = /\d{2}:\d{2}:\d{2},\d{1,3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{1,3}/;
    const nonStandardTimestampPattern = /\d{2}:\d{2}:\d{1,3},\d{2}:\d{2}:\d{1,3}/;
    
    if (!standardTimestampPattern.test(srtContent) && !nonStandardTimestampPattern.test(srtContent)) {
      return { isValid: false, error: "Invalid SRT format - no valid timestamps found" };
    }
    
    return { isValid: true };
  }
}

export const srtService = new SRTService();