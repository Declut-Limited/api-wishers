import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  // Socket.IO backs the live wallet, wishlist and wish item updates.
  app.useWebSocketAdapter(new IoAdapter(app));

  app.setGlobalPrefix('api');
  app.set('query parser', 'extended');
  // Railway puts one proxy in front of us: trust its X-Forwarded-For so req.ip (what the rate
  // limiter counts by) is each caller's own address, not the proxy's shared one.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '20mb' });
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
