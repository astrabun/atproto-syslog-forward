import {loadConfig} from './config.js';
import {JetstreamListener} from './jetstream.js';
import {SyslogClient} from './syslog.js';

async function main() {
  loadConfig();

  try {
    console.log('Starting ATProto JetStream Listener');

    // Load configuration
    const config = loadConfig();
    console.log(`Configuration loaded: MODE=${config.mode}`);
    console.log(
      `Subscriptions: ${config.subscriptions.join(', ')}, Actions: ${config.actions.join(', ')}`,
    );
    console.log(
      `Syslog: ${config.syslogHost}:${config.syslogPort} (facility: ${config.syslogFacility})`,
    );

    // Create syslog client
    const syslogClient = new SyslogClient(
      config.syslogHost,
      config.syslogPort,
      config.syslogFacility,
      config.syslogTag,
      config.syslogProto,
    );

    // Create and start JetStream listener
    const listener = new JetstreamListener(config, syslogClient);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      syslogClient.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      syslogClient.close();
      process.exit(0);
    });

    await listener.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

void main();
