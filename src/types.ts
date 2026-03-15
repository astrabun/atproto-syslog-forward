// Configuration types
export interface Config {
  mode: 'handle' | 'keyword';
  subscriptions: ('posts' | 'likes')[];
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
}
