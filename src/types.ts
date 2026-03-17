// Configuration types
export interface Config {
  mode: 'handle' | 'keyword';
  subscriptions: ('posts' | 'likes' | 'profile' | 'follows')[];
  actions: ('add' | 'delete')[];
  syslogHost: string;
  syslogPort: number;
  syslogFacility: number;
  syslogTag: string;
  syslogProto: 'tcp' | 'udp';

  // Handle mode specific
  handle?: string;
  did?: string;

  // Keyword mode specific
  keywords?: string[];

  // If we want to start at a cursor value
  cursor?: number;
  cursorCheckpointPath?: string;

  // TAP backfill settings (handle mode only)
  tapBackfill?: boolean;
  tapBackfillEndpoint?: string;
  tapBackfillUntil?: number;
}
