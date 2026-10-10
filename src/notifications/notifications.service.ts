import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notification.schema';
import { User } from '../users/schemas/user.schema';
import { PushService } from './push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { pageWindow } from '../common/utils/paginate.util';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly pushService: PushService,
    private readonly realtime: RealtimeService,
  ) {}

  // Stores the in-app notification, pings open devices, and pushes to the user's phone.
  async notify(
    userId: string,
    params: { title: string; body: string; type?: string; reference?: string },
  ): Promise<void> {
    const notification = await this.notificationModel.create({
      ...params,
      owner: userId,
    });
    this.realtime.notificationCreated(userId, notification._id.toString());

    const user = await this.userModel
      .findById(userId)
      .select('pushToken')
      .exec();
    if (!user?.pushToken) return;

    const result = await this.pushService.send(user.pushToken, {
      title: params.title,
      body: params.body,
      data: {
        notificationId: notification._id.toString(),
        ...(params.type ? { type: params.type } : {}),
        ...(params.reference ? { reference: params.reference } : {}),
      },
    });
    // Only clear the token if it's still the dead one (a new login may have replaced it).
    if (result === 'invalid_token') {
      await this.userModel.updateOne(
        { _id: userId, pushToken: user.pushToken },
        { $unset: { pushToken: 1 } },
      );
    }
  }

  async listMine(userId: string, dto: ListNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter = {
      owner: userId,
      ...(dto.read !== undefined ? { read: dto.read } : {}),
    };
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return {
      count: await this.notificationModel.countDocuments({
        owner: userId,
        read: false,
      }),
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.owner.toString() !== userId) {
      throw new ForbiddenException('You do not own this notification');
    }
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.notificationModel.updateMany(
      { owner: userId, read: false },
      { read: true, readAt: new Date() },
    );
    return { updated: res.modifiedCount };
  }

  async registerToken(userId: string, token: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { pushToken: token });
  }
}
