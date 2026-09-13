import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolGuard } from '../auth/rol.guard.js';
import { PanelController } from './panel.controller.js';
import { PanelService } from './panel.service.js';

@Module({
  controllers: [PanelController],
  providers: [PanelService, JwtGuard, RolGuard],
})
export class PanelModule {}