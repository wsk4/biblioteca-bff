import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Libro = {
  id: number;
  titulo: string;
  autor: string;
  anio: number | null;
  paginas: number | null;
  categoria: string;
  isbn13: string | null;
  sinopsis: string;
  ejemplares: number;
};

export type Prestamo = {
  id: number;
  libroId: number;
  usuarioSub: string;
  desde: string;
  hasta: string;
  devuelto: boolean;
};

@Injectable()
export class PanelService {
  private readonly librosUrl: string;
  private readonly prestamosUrl: string;

  constructor(config: ConfigService) {
    this.librosUrl = config.getOrThrow<string>('LIBROS_URL');
    this.prestamosUrl = config.getOrThrow<string>('PRESTAMOS_URL');
  }

  // fetch NO lanza con un 404 ni con un 500: hay que mirar .ok a mano.
  private async pedir<T>(url: string, nombre: string): Promise<T> {
    let respuesta: Response;

    try {
      respuesta = await fetch(url);
    } catch {
      throw new ServiceUnavailableException(
        `el microservicio de ${nombre} no responde`,
      );
    }

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `el microservicio de ${nombre} devolvio ${respuesta.status}`,
      );
    }

    return (await respuesta.json()) as T;
  }

  // Las dos llamadas salen juntas.
  private async traerTodo(): Promise<[Libro[], Prestamo[]]> {
    return Promise.all([
      this.pedir<Libro[]>(this.librosUrl, 'libros'),
      this.pedir<Prestamo[]>(this.prestamosUrl, 'prestamos'),
    ]);
  }

  // El cruce entre los préstamos y los libros.
  private unir(prestamos: Prestamo[], libros: Libro[]) {
    const porId = new Map(libros.map((libro) => [libro.id, libro]));

    return prestamos.map(({ libroId, ...resto }) => ({
      ...resto,
      libro: porId.get(libroId) ?? {
        id: libroId,
        titulo: 'libro no encontrado',
      },
    }));
  }

  async mios(sub: string) {
    const [libros, prestamos] = await this.traerTodo();
    const mios = prestamos.filter((prestamo) => prestamo.usuarioSub === sub);

    return {
      total: mios.length,
      prestamos: this.unir(mios, libros),
    };
  }

  async todos() {
    const [libros, prestamos] = await this.traerTodo();

    return {
      total: prestamos.length,
      prestamos: this.unir(prestamos, libros),
    };
  }

  // Solo para medir la diferencia serie/paralelo.
  async miosEnSerie(sub: string) {
    const libros = await this.pedir<Libro[]>(this.librosUrl, 'libros');
    const prestamos = await this.pedir<Prestamo[]>(
      this.prestamosUrl,
      'prestamos',
    );
    const mios = prestamos.filter((prestamo) => prestamo.usuarioSub === sub);

    return {
      total: mios.length,
      prestamos: this.unir(mios, libros),
    };
  }

  private async enviar<T>(
    metodo: string,
    url: string,
    cuerpo?: unknown,
  ): Promise<T> {
    let respuesta: Response;

    try {
      respuesta = await fetch(url, {
        method: metodo,
        headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw new ServiceUnavailableException(
        'el microservicio de prestamos no responde',
      );
    }

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `el microservicio de prestamos devolvio ${respuesta.status}`,
      );
    }

    return (await respuesta.json()) as T;
  }

  async prestar(sub: string, libroId: unknown): Promise<Prestamo> {
    if (
      typeof libroId !== 'number' ||
      !Number.isInteger(libroId) ||
      libroId < 1
    ) {
      throw new BadRequestException(
        'libroId tiene que ser un numero entero positivo',
      );
    }

    const [libros, prestamos] = await this.traerTodo();

    const libro = libros.find((elemento) => elemento.id === libroId);

    if (!libro) {
      throw new NotFoundException(`no existe el libro ${libroId}`);
    }

    const enPrestamo = prestamos.filter(
      (prestamo) =>
        prestamo.libroId === libroId && !prestamo.devuelto,
    ).length;

    if (enPrestamo >= libro.ejemplares) {
      throw new ConflictException(
        `no quedan ejemplares de "${libro.titulo}"`,
      );
    }

    const hoy = new Date();
    const dia = (cantidadDias: number) =>
      new Date(hoy.getTime() + cantidadDias * 86400000)
        .toISOString()
        .slice(0, 10);

    return this.enviar<Prestamo>('POST', this.prestamosUrl, {
      libroId,
      usuarioSub: sub,
      desde: dia(0),
      hasta: dia(14),
      devuelto: false,
    });
  }

  async devolver(sub: string, id: number): Promise<Prestamo> {
    const [, prestamos] = await this.traerTodo();

    const prestamo = prestamos.find((elemento) => elemento.id === id);

    if (!prestamo || prestamo.usuarioSub !== sub) {
      throw new NotFoundException(`no existe el prestamo ${id}`);
    }

    if (prestamo.devuelto) {
      throw new ConflictException(
        `el prestamo ${id} ya estaba devuelto`,
      );
    }

    return this.enviar<Prestamo>(
      'DELETE',
      `${this.prestamosUrl}/${id}`,
    );
  }
}