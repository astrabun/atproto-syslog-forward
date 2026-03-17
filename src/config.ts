import {type Config} from './types.js';
import {config} from '@dotenvx/dotenvx';

export function loadConfig(): Config {
  config(); // Load .env
  const mode = process.env.MODE || 'handle';

  const cursor = process.env.JETSTREAM_CURSOR_START
    ? parseInt(process.env.JETSTREAM_CURSOR_START)
    : undefined;

  const cursorCheckpointPath = process.env.JETSTREAM_CURSOR_CHECKPOINT_PATH;

  if (mode !== 'handle' && mode !== 'keyword') {
    throw new Error(`Invalid MODE: ${mode}. Must be 'handle' or 'keyword'`);
  }

  // Parse subscriptions
  const subscriptionsStr = process.env.SUBSCRIPTIONS || 'posts,likes';
  const subscriptions = subscriptionsStr
    .split(',')
    .map((subsString) => subsString.trim().toLowerCase())
    .filter(
      (subsString): subsString is 'posts' | 'likes' | 'profile' | 'follows' =>
        subsString === 'posts' ||
        subsString === 'likes' ||
        subsString === 'profile' ||
        subsString === 'follows',
    );

  if (subscriptions.length === 0) {
    throw new Error(
      'SUBSCRIPTIONS must contain at least one of: posts, likes, profile, follows',
    );
  }

  // Parse actions
  const actionsStr = process.env.ACTIONS || 'add,delete';
  const actions = actionsStr
    .split(',')
    .map((actString) => actString.trim().toLowerCase())
    .filter(
      (actString): actString is 'add' | 'delete' =>
        actString === 'add' || actString === 'delete',
    );

  if (actions.length === 0) {
    throw new Error('ACTIONS must contain at least one of: add, delete');
  }

  // Syslog configuration
  const syslogHost = process.env.SYSLOG_HOST;
  const syslogPortStr = process.env.SYSLOG_PORT;

  if (!syslogHost) {
    throw new Error('SYSLOG_HOST is required');
  }

  const syslogPort = syslogPortStr ? parseInt(syslogPortStr, 10) : 514;
  if (isNaN(syslogPort) || syslogPort < 1 || syslogPort > 65535) {
    throw new Error(
      `Invalid SYSLOG_PORT: ${syslogPortStr}. Must be between 1 and 65535`,
    );
  }

  const syslogFacility = parseFacility(process.env.SYSLOG_FACILITY || 'local0');
  const syslogTag = process.env.SYSLOG_TAG || 'atproto-listener';
  const syslogProto = process.env.SYSLOG_PROTOCOL || 'tcp';
  if (syslogProto !== 'tcp' && syslogProto !== 'udp') {
    throw new Error(
      `Invalid SYSLOG_PROTOCOL: ${syslogProto}. Must be 'tcp' or 'udp'`,
    );
  }

  // Mode-specific validation
  if (mode === 'handle') {
    const handle = process.env.HANDLE;
    if (!handle) {
      throw new Error('HANDLE is required when MODE is "handle"');
    }

    const tapBackfill = process.env.TAP_BACKFILL === 'true';
    const tapBackfillEndpoint = process.env.TAP_BACKFILL_ENDPOINT;
    const tapBackfillUntilStr = process.env.TAP_BACKFILL_UNTIL;

    if (tapBackfill && !tapBackfillEndpoint) {
      throw new Error(
        'TAP_BACKFILL_ENDPOINT is required when TAP_BACKFILL is true',
      );
    }

    let tapBackfillUntil: number | undefined;
    if (tapBackfillUntilStr) {
      tapBackfillUntil = parseInt(tapBackfillUntilStr, 10);
      if (isNaN(tapBackfillUntil)) {
        throw new Error(
          `Invalid TAP_BACKFILL_UNTIL: ${tapBackfillUntilStr}. Must be a valid number (microseconds)`,
        );
      }
    }

    // oxlint-disable-next-line sort-keys
    return {
      mode,
      handle,
      did: process.env.DID,
      subscriptions,
      actions,
      syslogHost,
      syslogPort,
      syslogFacility,
      syslogTag,
      syslogProto,
      cursor,
      cursorCheckpointPath,
      tapBackfill,
      tapBackfillEndpoint,
      tapBackfillUntil,
    };
  } else {
    const keywordsStr = process.env.KEYWORDS;
    if (!keywordsStr) {
      throw new Error('KEYWORDS is required when MODE is "keyword"');
    }

    const keywords = keywordsStr
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    if (keywords.length === 0) {
      throw new Error('KEYWORDS must contain at least one keyword');
    }

    // oxlint-disable-next-line sort-keys
    return {
      mode,
      keywords,
      subscriptions,
      actions,
      syslogHost,
      syslogPort,
      syslogFacility,
      syslogTag,
      syslogProto,
      cursor,
      cursorCheckpointPath,
    };
  }
}

function parseFacility(facilityStr: string): number {
  // oxlint-disable-next-line sort-keys
  const facilities: Record<string, number> = {
    kernel: 0,
    user: 1,
    mail: 2,
    daemon: 3,
    auth: 4,
    syslog: 5,
    lpr: 6,
    news: 7,
    uucp: 8,
    cron: 9,
    local0: 16,
    local1: 17,
    local2: 18,
    local3: 19,
    local4: 20,
    local5: 21,
    local6: 22,
    local7: 23,
  };

  const lower = facilityStr.toLowerCase();
  if (lower in facilities) {
    return facilities[lower];
  }

  const num = parseInt(facilityStr, 10);
  if (!isNaN(num) && num >= 0 && num <= 23) {
    return num;
  }

  throw new Error(
    `Invalid SYSLOG_FACILITY: ${facilityStr}. Must be a valid facility name or number 0-23`,
  );
}
