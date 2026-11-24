export const DETAIL_KEYS = ['terminals', 'photos', 'queues', 'disk', 'push', 'stats'] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];
