export type DiscussionSource = "hacker_news";

export type DiscussionCandidate = {
  externalId: string;
  title: string;
  excerpt: string;
  url: string;
  publishedAt: Date;
  engagementCount: number | null;
};

export type SourceScan = {
  checkedCount: number;
  candidates: DiscussionCandidate[];
  partialFailures: number;
};

export interface DiscussionSourceConnector {
  readonly id: DiscussionSource;
  readonly displayName: string;
  scan(maxStories: number): Promise<SourceScan>;
}
