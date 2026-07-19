export interface Video {
  slug: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  views: number;
  createdAt: string;
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
