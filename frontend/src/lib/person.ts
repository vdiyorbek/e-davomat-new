interface NameParts {
    lastName?: string | null;
    firstName?: string | null;
    middleName?: string | null;
}

/** «Familiya Ism Otasining ismi» ko‘rinishidagi to‘liq ism. */
export function personFullName(person: NameParts | null | undefined, fallback = ''): string {
    if (!person) return fallback;

    return (
        [person.lastName, person.firstName, person.middleName]
            .filter(Boolean)
            .join(' ') || fallback
    );
}

/** Avatar uchun bosh harflar: «AV». */
export function personInitials(person: NameParts | null | undefined, fallback = '?'): string {
    if (!person) return fallback;

    const initials = [person.firstName?.charAt(0), person.lastName?.charAt(0)]
        .filter(Boolean)
        .join('')
        .toUpperCase();

    return initials || fallback;
}
