import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { LiveEvent } from '../hikvision-push/hikvision-push.types';

export interface LiveSourceEvent {
  id: string;
  schoolId: number;
  terminalId: number;
  direction: string;
  eventAt: Date;
  date: string;
  pnfl: string;
  photoPath: string | null;
}

interface PersonRow {
  pnfl: string;
  personId: number | string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  type: 'STUDENT' | 'TEACHER';
  className: string | null;
}

/** Eventlarga shaxs ismi, turi (o‘quvchi/o‘qituvchi) va sinfini qo‘shadi. */
@Injectable()
export class LivePeopleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async enrich(events: LiveSourceEvent[]): Promise<Map<number, LiveEvent[]>> {
    const bySchool = new Map<number, LiveEvent[]>();
    if (events.length === 0) return bySchool;

    // Bitta so‘rov: paketdagi barcha maktab+pnfl juftliklari.
    const pairs = [
      ...new Map(
        events.map((e) => [`${e.schoolId}:${e.pnfl}:${e.date}`, e]),
      ).values(),
    ];
    const params: unknown[] = [];
    const conditions = pairs
      .map((e) => {
        params.push(e.schoolId, e.pnfl, e.date, e.date);
        return `(m.schoolId = ? AND p.pnfl = ? AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?))`;
      })
      .join(' OR ');

    const rows: PersonRow[] = await this.dataSource.query(
      `SELECT m.schoolId, p.pnfl, p.id AS personId, p.firstName, p.lastName,
              p.middleName, m.type, c.name AS className
         FROM school_memberships m
         JOIN persons p ON p.id = m.personId AND p.deletedAt IS NULL
         LEFT JOIN school_classes c ON c.id = m.classId
        WHERE ${conditions}`,
      params,
    );

    const people = new Map<string, PersonRow>();
    for (const row of rows as (PersonRow & { schoolId: number })[]) {
      const key = `${row.schoolId}:${row.pnfl}`;
      // Ikkala a’zolik bo‘lsa, o‘qituvchi ko‘rsatiladi.
      if (!people.has(key) || row.type === 'TEACHER') people.set(key, row);
    }

    for (const event of events) {
      const person = people.get(`${event.schoolId}:${event.pnfl}`);
      const list = bySchool.get(event.schoolId) ?? [];
      list.push({
        eventId: event.id,
        terminalId: event.terminalId,
        direction: event.direction,
        eventAt: event.eventAt.toISOString(),
        pnfl: event.pnfl,
        hasPhoto: Boolean(event.photoPath),
        person: person
          ? {
              id: Number(person.personId),
              firstName: person.firstName,
              lastName: person.lastName,
              middleName: person.middleName,
            }
          : null,
        membershipType: person?.type ?? null,
        className: person?.type === 'STUDENT' ? person.className : null,
      });
      bySchool.set(event.schoolId, list);
    }

    return bySchool;
  }
}
