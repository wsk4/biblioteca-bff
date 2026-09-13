import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES } from './roles.decorator.js';
import type { Usuario } from './jwt.guard.js';

@Injectable()
export class RolGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridos = this.reflector.get<string[]>(
      ROLES,
      ctx.getHandler(),
    );

    // Una ruta sin @Roles no exige grupo.
    if (!requeridos) {
      return true;
    }

    const req = ctx
      .switchToHttp()
      .getRequest<{ usuario: Usuario }>();

    const gruposUsuario = req.usuario.grupos;

    const tieneGrupo = requeridos.some((grupo) =>
      gruposUsuario.includes(grupo),
    );

    if (!tieneGrupo) {
      throw new ForbiddenException(
        `necesitas estar en ${requeridos.join(' o ')}`,
      );
    }

    return true;
  }
}