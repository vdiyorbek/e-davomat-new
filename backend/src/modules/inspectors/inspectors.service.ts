import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { District } from '../districts/district.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/user.entity';

import { SetInspectorMahallasDto } from './dto/set-inspector-mahallas.dto';
import { InspectorMahalla } from './inspector-mahalla.entity';
import { MAX_MAHALLAS_PER_INSPECTOR, normalizeIds } from './inspector.rules';

@Injectable()
export class InspectorsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,
    @InjectRepository(Mahalla)
    private readonly mahallasRepository: Repository<Mahalla>,
    @InjectRepository(InspectorMahalla)
    private readonly assignmentsRepository: Repository<InspectorMahalla>,
  ) {}

  /** Uchastkavoyga biriktirilgan mahallalar (admin ko'rinishi). */
  async getMahallas(userId: number, actor: AuthenticatedUser) {
    const inspector = await this.loadInspector(userId);
    await this.checkAdminAccess(inspector, actor);

    const rows = await this.assignmentsRepository.find({
      where: { userId },
      relations: { mahalla: true },
      order: { id: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.mahalla.id,
      name: row.mahalla.name,
      isActive: row.mahalla.isActive,
    }));
  }

  /** Biriktirilgan mahallalar ro'yxatini to'liq almashtiradi. */
  async setMahallas(
    userId: number,
    dto: SetInspectorMahallasDto,
    actor: AuthenticatedUser,
  ) {
    const inspector = await this.loadInspector(userId);
    await this.checkAdminAccess(inspector, actor);

    const ids = normalizeIds(dto.mahallaIds);

    if (ids.length > MAX_MAHALLAS_PER_INSPECTOR) {
      throw new BadRequestException(
        `Bitta uchastkavoyga ko‘pi bilan ${MAX_MAHALLAS_PER_INSPECTOR} ta mahalla biriktiriladi`,
      );
    }

    if (ids.length > 0) {
      const found = await this.mahallasRepository.find({
        where: {
          id: In(ids),
          districtId: inspector.districtId!,
          isActive: true,
        },
        select: { id: true },
      });

      if (found.length !== ids.length) {
        throw new BadRequestException(
          'Mahallalar uchastkavoy tumanida bo‘lishi va faol bo‘lishi kerak',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(InspectorMahalla, { userId });

      if (ids.length > 0) {
        await manager.insert(
          InspectorMahalla,
          ids.map((mahallaId) => ({ userId, mahallaId })),
        );
      }
    });

    return this.getMahallas(userId, actor);
  }

  private async loadInspector(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user || user.role !== UserRole.MAHALLA_INSPECTOR) {
      throw new NotFoundException('Uchastkavoy topilmadi');
    }

    if (user.districtId === null) {
      throw new BadRequestException('Uchastkavoyga tuman biriktirilmagan');
    }

    return user;
  }

  /** Super admin hammasiga; viloyat admini o'z viloyati, tuman admini o'z tumani uchun. */
  private async checkAdminAccess(
    inspector: User,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    if (actor.role === UserRole.DISTRICT_ADMIN) {
      if (
        actor.districtId !== null &&
        actor.districtId === inspector.districtId
      ) {
        return;
      }
      throw new ForbiddenException('Ruxsat yo‘q');
    }

    if (actor.role === UserRole.REGION_ADMIN && actor.regionId !== null) {
      const district = await this.districtsRepository.findOne({
        where: { id: inspector.districtId! },
        select: { id: true, regionId: true },
      });

      if (district && district.regionId === actor.regionId) return;
    }

    throw new ForbiddenException('Ruxsat yo‘q');
  }
}
