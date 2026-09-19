export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';

export interface Subscriber {
  id: number;
  email: string;
  status: SubscriberStatus;
  locale: string | null;
  source: string | null;
  consent_at: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string | null;
}

export interface SubscriberListResponse {
  subscribers: Subscriber[];
  counts: Record<SubscriberStatus, number>;
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    total: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
