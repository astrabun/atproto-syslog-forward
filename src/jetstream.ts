import {readFile, writeFile, access} from 'node:fs/promises';
import {JetstreamSubscription} from '@atcute/jetstream';
import {type Config} from './types.js';
import {type SyslogClient} from './syslog.js';
import {actorResolver} from './resolver.js';
import {type Did, type Handle} from '@atcute/lexicons/syntax';

export class JetstreamListener {
  // oxlint-disable-next-line unicorn/no-null
  private subscription: JetstreamSubscription | null = null;
  private syslogClient: SyslogClient;
  private config: Config;
  private retryDelay = 1000; // Start with 1 second
  private maxRetryDelay = 30000; // Max 30 seconds
  // oxlint-disable-next-line unicorn/no-null, no-redundant-type-constituents
  private abortController: AbortController | null = null;

  constructor(config: Config, syslogClient: SyslogClient) {
    this.config = config;
    this.syslogClient = syslogClient;
  }

  async start(): Promise<void> {
    console.log(`Starting JetStream listener in ${this.config.mode} mode`);

    if (this.config.mode === 'handle') {
      await this.startHandleMode();
    } else {
      await this.startKeywordMode();
    }
  }

  private async startHandleMode(): Promise<void> {
    const {handle, did, cursor, cursorCheckpointPath} = this.config;
    const actor = {
      did: did ?? undefined,
    };

    const jetstreamCursorDetails = {
      cursor,
      cursorCheckpointPath,
    };

    if (jetstreamCursorDetails.cursorCheckpointPath) {
      try {
        const fileExists = await access(jetstreamCursorDetails.cursorCheckpointPath).then(() => true).catch(() => false);
        if (fileExists) {
          const data = await readFile(jetstreamCursorDetails.cursorCheckpointPath, 'utf8');
          const parsed = JSON.parse(data) as {cursor: number};
          jetstreamCursorDetails.cursor = parsed.cursor;
          console.log(`Loaded cursor ${jetstreamCursorDetails.cursor} from ${jetstreamCursorDetails.cursorCheckpointPath}`);
        }
      } catch (error) {
        // Some other issue occurred.
        console.error(`Unable to load cursor position from ${jetstreamCursorDetails.cursorCheckpointPath}`);
        console.error(error);
      }
    }

    if (!actor.did) {
      if (!handle) {
        throw new Error('Missing handle or DID from config');
      }
      console.log(`Resolving handle ${handle} to DID...`);
      const did = await actorResolver.resolve(handle as Handle);
      actor.did = did.did;
      console.log(`Resolved to ${actor.did}`);
    } else {
      console.log(`Using DID ${actor.did}`);
    }

    while (true) {
      try {
        this.abortController = new AbortController();

        // Create subscription with wanted DIDs or let it receive all events and filter
        const wantedCollections = [];
        if (this.config.subscriptions.includes('posts')) {
          wantedCollections.push('app.bsky.feed.post');
        }
        if (this.config.subscriptions.includes('likes')) {
          wantedCollections.push('app.bsky.feed.like');
        }
        if (this.config.subscriptions.includes('profile')) {
          wantedCollections.push('app.bsky.actor.profile');
        }
        if (this.config.subscriptions.includes('follows')) {
          wantedCollections.push('app.bsky.graph.follow');
        }
        const subscriptionOptions = {
          cursor: jetstreamCursorDetails.cursor,
          url: 'wss://jetstream2.us-east.bsky.network',
          wantedCollections,
          wantedDids: [actor.did] as Did[],
        };

        if (jetstreamCursorDetails.cursor) {
          console.log(`Starting cursor at ${jetstreamCursorDetails.cursor}`);
        } else {
          console.log('Starting cursor @ present.');
        }

        this.subscription = new JetstreamSubscription(subscriptionOptions);
        console.log(`Cursor @ ${this.subscription.cursor}`);

        const cursorSaveInterval = cursorCheckpointPath
          ? setInterval(() => {
              if (this.subscription?.cursor !== undefined) {
                void writeFile(cursorCheckpointPath, JSON.stringify({cursor: this.subscription.cursor}));
              }
            }, 60_000)
          : undefined;

        try {
          for await (const event of this.subscription) {
            console.log(`Event occurred @ cursor: ${this.subscription.cursor}`);
            try {
              if (this.abortController.signal.aborted) {
                break;
              }

              if (event.kind === 'commit') {
                await this.syslogClient.send(event);
              }
            } catch (error) {
              console.error('Error processing event:', error);
            }
          }
        } finally {
          clearInterval(cursorSaveInterval);
        }
      } catch (error) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        console.error('JetStream error:', error);
        console.log(`Reconnecting in ${this.retryDelay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        this.retryDelay = Math.min(this.retryDelay * 1.5, this.maxRetryDelay);
      }
    }
  }

  private async startKeywordMode(): Promise<void> {
    throw new Error('Keyword Mode Not Yet Implemented :3c');
  }
}
