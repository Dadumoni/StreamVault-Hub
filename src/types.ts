export interface Video {
  slug: string;
  title: string;
  description: string;
  videoUrl: string;
  downloadUrl?: string;
  thumbnailUrl: string;
  duration: string;
  views: number;
  fileSize?: number;
  createdAt: string;
  mp4_urls?: Record<string, string>;
  hls_playlist_url?: string;
}

export interface TaskConfig {
  task1Link: string;
  task2Link: string;
  task3Link: string;
}

export interface SessionStatus {
  task1Completed: boolean;
  task2Completed: boolean;
  task3Completed: boolean;
}
