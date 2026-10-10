import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

export type RealtimeAction = 'created' | 'updated' | 'deleted';

// Live "this changed, refetch it" pings to the owner's devices — no data payload beyond ids.
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  wishlistChanged(
    ownerId: string,
    wishlistId: string,
    action: RealtimeAction,
  ): void {
    this.gateway.emitToUser(ownerId, 'wishlist:update', {
      wishlistId,
      action,
    });
  }

  wishItemChanged(
    ownerId: string,
    wishItemId: string,
    wishlistId: string,
    action: RealtimeAction,
  ): void {
    this.gateway.emitToUser(ownerId, 'wishItem:update', {
      wishItemId,
      wishlistId,
      action,
    });
  }

  walletChanged(userId: string): void {
    this.gateway.emitToUser(userId, 'wallet:update', {});
  }

  notificationCreated(userId: string, notificationId: string): void {
    this.gateway.emitToUser(userId, 'notification', { notificationId });
  }
}
