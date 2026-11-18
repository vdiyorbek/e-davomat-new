
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { School } from '../schools/school.entity';

@Entity('school_shifts')
@Index('UQ_school_shifts_school_code', ['schoolId', 'code'], {
    unique: true,
})
export class SchoolShift {
    @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
    id!: number;

    @Column({ type: 'int', unsigned: true })
    schoolId!: number;

    @ManyToOne(() => School, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'schoolId',
        foreignKeyConstraintName: 'FK_school_shifts_school',
    })
    school!: School;

    @Column({ type: 'tinyint', unsigned: true })
    code!: number;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'time' })
    startTime!: string;

    @Column({ type: 'time' })
    endTime!: string;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @CreateDateColumn({ type: 'datetime', precision: 3 })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime', precision: 3 })
    updatedAt!: Date;
}
