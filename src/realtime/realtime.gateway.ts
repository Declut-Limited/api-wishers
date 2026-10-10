import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';

// Replaces the app's Firestore listeners: each signed-in device joins its own room and gets pinged when its data changes.
@Injectable()
@WebSocketGateway({ namespace: 'realtime', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret: this.config.get<string>('JWT_ACCESS_SECRET') },
      );
      await client.join(this.userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.server) return;
    try {
      this.server.to(this.userRoom(userId)).emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Failed to emit "${event}" to user ${userId}`,
        err as Error,
      );
    }
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth.startsWith('Bearer ') ? fromAuth.slice(7) : fromAuth;
    }
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}
