
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

import { SchoolClass } from './school-class.entity';
import { SchoolShift } from './school-shift.entity';

@Entity('school_class_shifts')
@Index('UQ_class_shifts_start', ['classId', 'startDate'], {
    unique: true,
})
@Index('IDX_class_shifts_dates', [
    'classId',
    'startDate',
    'endDate',
])
@Index('IDX_class_shifts_shift', ['shiftId'])
export class SchoolClassShift {
    @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
    id!: number;

    @Column({ type: 'int', unsigned: true })
    classId!: number;

    @ManyToOne(() => SchoolClass, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'classId',
        foreignKeyConstraintName: 'FK_class_shifts_class',
    })
    schoolClass!: SchoolClass;

    @Column({ type: 'int', unsigned: true })
    shiftId!: number;

    @ManyToOne(() => SchoolShift, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'shiftId',
        foreignKeyConstraintName: 'FK_class_shifts_shift',
    })
    shift!: SchoolShift;

    @Column({ type: 'date' })
    startDate!: string;

    // Tugash sanasi intervalga kirmaydi.
    @Column({ type: 'date', nullable: true })
    endDate!: string | null;

    @CreateDateColumn({ type: 'datetime', precision: 3 })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime', precision: 3 })
    updatedAt!: Date;
}
