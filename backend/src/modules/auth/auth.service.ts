import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../common/security/password';
import { User } from '../users/user.entity';
import { AuthSession } from './auth-session.entity';
import { LoginDto } from './dto/login.dto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash!: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await hashPassword(
      randomBytes(32).toString('hex'),
    );
  }

  private hashToken(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private tokenMatches(secret: string, storedHash: string): boolean {
    const actual = Buffer.from(this.hashToken(secret), 'hex');
    const expected = Buffer.from(storedHash, 'hex');

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private parseRefreshToken(value: string | undefined) {
    if (!value) return null;

    const match = value.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/i,
    );

    if (!match) return null;

    return {
      sessionId: match[1],
      secret: match[2],
    };
  }

  private async buildResult(user: User, session: AuthSession, secret: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: String(user.id),
      sid: session.id,
    });

    return {
      refreshToken: `${session.id}.${secret}`,
      expiresAt: session.expiresAt,
      body: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: user.id,
          login: user.login,
          personId: user.personId,
          firstName: user.person.firstName,
          lastName: user.person.lastName,
        },
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .innerJoinAndSelect('user.person', 'person')
      .where('user.login = :login', { login: dto.login })
      .andWhere('person.deletedAt IS NULL')
      .getOne();

    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? this.dummyPasswordHash,
      dto.password,
    );

    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    }

    const secret = randomBytes(32).toString('hex');

    return this.dataSource.transaction(async (manager) => {
      const session = manager.create(AuthSession, {
        userId: user.id,
        refreshTokenHash: this.hashToken(secret),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        revokedAt: null,
      });

      const saved = await manager.save(session);

      return this.buildResult(user, saved, secret);
    });
  }

  async refresh(rawToken: string | undefined) {
    const parsed = this.parseRefreshToken(rawToken);

    if (!parsed) {
      throw new UnauthorizedException('Sessiya topilmadi');
    }

    return this.dataSource.transaction(async (manager) => {
      const session = await manager
        .getRepository(AuthSession)
        .createQueryBuilder('session')
        .addSelect('session.refreshTokenHash')
        .where('session.id = :id', { id: parsed.sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= Date.now() ||
        !this.tokenMatches(parsed.secret, session.refreshTokenHash)
      ) {
        throw new UnauthorizedException(
          'Sessiya yaroqsiz yoki muddati tugagan',
        );
      }

      const user = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.person', 'person')
        .where('user.id = :id', { id: session.userId })
        .andWhere('user.isActive = :active', { active: true })
        .andWhere('person.deletedAt IS NULL')
        .getOne();

      if (!user) {
        throw new UnauthorizedException('Hisob faol emas');
      }

      // Har muvaffaqiyatli refresh'da yangi maxfiy qiymat.
      const secret = randomBytes(32).toString('hex');
      session.refreshTokenHash = this.hashToken(secret);

      await manager.save(session);

      // Sessiyaning dastlabki 7 kunlik muddati uzaytirilmaydi.
      return this.buildResult(user, session, secret);
    });
  }

  async logout(rawToken: string | undefined): Promise<void> {
    const parsed = this.parseRefreshToken(rawToken);
    if (!parsed) return;

    await this.dataSource.transaction(async (manager) => {
      const session = await manager
        .getRepository(AuthSession)
        .createQueryBuilder('session')
        .addSelect('session.refreshTokenHash')
        .where('session.id = :id', { id: parsed.sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !session ||
        session.revokedAt !== null ||
        !this.tokenMatches(parsed.secret, session.refreshTokenHash)
      ) {
        return;
      }

      session.revokedAt = new Date();
      await manager.save(session);
    });
  }
}
