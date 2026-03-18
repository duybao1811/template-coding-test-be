import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from './config/database.config';
import openaiConfig from './config/openai.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, openaiConfig, appConfig],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'mysql',

        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),

        autoLoadEntities: true,

        synchronize: configService.get<boolean>('database.synchronize'),
        logging: true,

        ssl: configService.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
