import { CalendarClock, ScanFace, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { EventSyncHistorySection } from './EventSyncHistorySection';
import { PersonSyncHistoryPage } from './PersonSyncHistoryPage';

type Tab = 'events' | 'persons';

export function SyncHistoryPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab: Tab = searchParams.get('tab') === 'persons' ? 'persons' : 'events';

    return (
        <div className="w-full min-w-0 space-y-5">
            <PageHeader
                eyebrow={t('terminals.eyebrow')}
                title={t('syncHistory.title')}
                description={t('syncHistory.description')}
                actions={
                    <Button asChild variant="outline">
                        <Link to="/terminals">
                            <ScanFace aria-hidden="true" />
                            {t('terminals.title')}
                        </Link>
                    </Button>
                }
            />

            <Tabs
                value={tab}
                onValueChange={(next) => setSearchParams(next === 'persons' ? { tab: 'persons' } : {})}
                className="gap-5"
            >
                <TabsList className="h-11 w-full sm:w-fit">
                    <TabsTrigger value="events" className="px-4">
                        <CalendarClock aria-hidden="true" />
                        {t('syncHistory.tabs.events')}
                    </TabsTrigger>
                    <TabsTrigger value="persons" className="px-4">
                        <Users aria-hidden="true" />
                        {t('syncHistory.tabs.persons')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="events">
                    <EventSyncHistorySection />
                </TabsContent>
                <TabsContent value="persons">
                    <PersonSyncHistoryPage embedded />
                </TabsContent>
            </Tabs>
        </div>
    );
}
