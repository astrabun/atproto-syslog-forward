import dgram from 'dgram';
import net from 'net';
import os from 'os';

export class SyslogClient {
  private udpClient?: dgram.Socket;
  private tcpClient?: net.Socket;
  private host: string;
  private port: number;
  private facility: number;
  private tag: string;
  private hostname: string;
  private protocol: 'udp' | 'tcp';

  // oxlint-disable-next-line max-params
  constructor(
    host: string,
    port: number,
    facility: number,
    tag: string,
    protocol: 'udp' | 'tcp' = 'udp',
  ) {
    this.host = host;
    this.port = port;
    this.facility = facility;
    this.tag = tag;
    this.hostname = os.hostname();
    this.protocol = protocol;

    if (this.protocol === 'udp') {
      this.udpClient = dgram.createSocket('udp4');
    }
  }

  send(event: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const severity = this.getSeverity(event.event_type);
        const priority = this.facility * 8 + severity;

        // RFC 3164 format: <PRI>HOSTNAME TAG[PID]: MESSAGE
        const message = JSON.stringify(event);
        const syslogMessage = `<${priority}>${this.hostname} ${this.tag}: ${message}`;
        const payload =
          this.protocol === 'tcp' ? `${syslogMessage}\n` : syslogMessage;

        const buffer = Buffer.from(payload);
        if (this.protocol === 'udp') {
          if (!this.udpClient) {
            reject(new Error('UDP client is not initialized'));
            return;
          }

          this.udpClient.send(
            buffer,
            0,
            buffer.length,
            this.port,
            this.host,
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            },
          );
          return;
        }

        if (!this.tcpClient || this.tcpClient.destroyed) {
          this.tcpClient = net.createConnection({
            host: this.host,
            port: this.port,
          });
        }

        this.tcpClient.write(buffer, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // oxlint-disable-next-line no-unused-vars
  private getSeverity(eventType: string): number {
    // Severity levels (RFC 5424)
    // 0=Emergency, 1=Alert, 2=Critical, 3=Error, 4=Warning, 5=Notice, 6=Info, 7=Debug
    // For all events, use Info level
    return 6; // Info
  }

  close(): void {
    if (this.udpClient) {
      this.udpClient.close();
    }

    if (this.tcpClient && !this.tcpClient.destroyed) {
      this.tcpClient.end();
      this.tcpClient.destroy();
    }
  }
}
