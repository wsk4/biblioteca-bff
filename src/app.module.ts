import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PanelModule } from './panel/panel.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PanelModule],
})
export class AppModule {}