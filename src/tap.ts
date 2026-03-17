import {type SyslogClient} from './syslog.js';

import WS from 'ws';

// Jetstream-compatible format (what we convert TAP events to)
interface JetstreamCommitEvent {
  did: string;
  time_us: number;
  kind: 'commit';
  commit: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

interface JetstreamIdentityEvent {
  did: string;
  time_us: number;
  kind: 'identity';
  identity: {
    did: string;
    handle: string;
  };
}

type JetstreamEvent = JetstreamCommitEvent | JetstreamIdentityEvent;

/**
 * Convert TAP event format to Jetstream format.
 * Extracts timestamp from the record's createdAt field when available.
 */
function tapToJetstream(evt: any): JetstreamEvent {
  const data = evt.record;
  let timeUs = Date.now() * 1000;

  if (evt.type === 'identity') {
    return {
      did: data.did,
      identity: {
        did: data.did,
        handle: data.handle,
      },
      kind: 'identity',
      time_us: timeUs,
    };
  }

  // Evt.type === 'record'
  // Extract timestamp from the nested record's createdAt field
  if (data.record?.createdAt) {
    const {createdAt} = data.record;
    if (typeof createdAt === 'string') {
      // Parse ISO 8601 string to microseconds
      timeUs = new Date(createdAt).getTime() * 1000;
    } else if (typeof createdAt === 'number') {
      // Handle numeric timestamps (assume microseconds if large, milliseconds if small)
      timeUs = createdAt > 1e12 ? createdAt : createdAt * 1000;
    }
  }

  return {
    commit: {
      cid: data.cid,
      collection: data.collection,
      operation: data.action,
      record: data.record,
      rev: data.rev,
      rkey: data.rkey,
    },
    did: data.did,
    kind: 'commit',
    time_us: timeUs,
  };
}

export class TapBackfillListener {
  private tapEndpoint: string;
  private syslogClient: SyslogClient;
  private wantedDid: string;
  private wantedCollections: string[];
  private backfillUntil?: number;

  // oxlint-disable-next-line max-params
  constructor(
    tapEndpoint: string,
    syslogClient: SyslogClient,
    wantedDid: string,
    wantedCollections: string[],
    backfillUntil?: number,
  ) {
    this.tapEndpoint = tapEndpoint;
    this.syslogClient = syslogClient;
    this.wantedDid = wantedDid;
    this.wantedCollections = wantedCollections;
    this.backfillUntil = backfillUntil;
  }

  async start(): Promise<void> {
    console.log(`Connecting to TAP backfill endpoint: ${this.tapEndpoint}`);
    console.log(
      `Listening for DID: ${this.wantedDid}, collections: ${this.wantedCollections.join(', ')}`,
    );
    if (this.backfillUntil) {
      console.log(`Backfill will stop at createdAt: ${this.backfillUntil} µs`);
    }

    return new Promise((resolve, reject) => {
      const ws = new WS(this.tapEndpoint);
      let backfillComplete = false;
      let eventCount = 0;

      ws.on('open', () => {
        console.log('Connected to TAP endpoint');
      });

      ws.on('message', async (data: any) => {
        try {
          const evt = JSON.parse(data.toString());

          // Validate event structure
          if (!evt.record || typeof evt.record !== 'object') {
            console.debug('Ignoring event without record field:', evt);
            return;
          }

          // Filter for wanted DID
          if (evt.record.did !== this.wantedDid) {
            return;
          }

          // Filter for wanted collections (for record events only)
          if (
            evt.type === 'record' &&
            !this.wantedCollections.includes(evt.record.collection)
          ) {
            return;
          }

          // Check if we should stop backfill based on createdAt time
          if (
            evt.type === 'record' &&
            this.backfillUntil &&
            evt.record.record?.createdAt
          ) {
            const createdAtMs =
              typeof evt.record.record.createdAt === 'string'
                ? new Date(evt.record.record.createdAt).getTime() * 1000
                : (evt.record.record.createdAt as number);

            if (createdAtMs >= this.backfillUntil) {
              console.log(
                `Reached backfill limit (createdAt: ${createdAtMs}, limit: ${this.backfillUntil}). Stopping backfill.`,
              );
              ws.close();
              return;
            }
          }

          // Check if we've transitioned from backfill to live
          if (evt.type === 'record' && evt.record.live && !backfillComplete) {
            backfillComplete = true;
            console.log(
              `TAP backfill complete for ${this.wantedDid}. Processed ${eventCount} events.`,
            );
          }

          // Convert to Jetstream format, extracting timestamp from record
          const jetstreamEvent = tapToJetstream(evt);

          // Send to syslog
          await this.syslogClient.send(jetstreamEvent);
          eventCount++;
        } catch (error) {
          console.error('Error processing TAP event:', error);
        }
      });

      ws.on('close', () => {
        console.log(`TAP connection closed after ${eventCount} events`);
        resolve();
      });

      ws.on('error', (error: Error) => {
        console.error('TAP WebSocket error:', error);
        reject(error);
      });
    });
  }
}
