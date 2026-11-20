import { CalendarClock, Eraser, RadioTower, ScanFace, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ClearHistorySection } from './ClearHistorySection';
import { EventSyncHistorySection } from './EventSyncHistorySection';
import { PersonSyncHistoryPage } from './PersonSyncHistoryPage';
import { PushActivitySection } from './PushActivitySection';

type Tab = 'events' | 'push' | 'persons' | 'clears';

export function SyncHistoryPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const tab: Tab = rawTab === 'persons' || rawTab === 'clears' || rawTab === 'push' ? rawTab : 'events';

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
                onValueChange={(next) => setSearchParams(next === 'events' ? {} : { tab: next })}
                className="gap-5"
            >
                <TabsList className="h-auto w-full flex-wrap sm:h-11 sm:w-fit sm:flex-nowrap">
                    <TabsTrigger value="events" className="px-4">
                        <CalendarClock aria-hidden="true" />
                        {t('syncHistory.tabs.events')}
                    </TabsTrigger>
                    <TabsTrigger value="push" className="px-4">
                        <RadioTower aria-hidden="true" />
                        {t('syncHistory.tabs.push')}
                    </TabsTrigger>
                    <TabsTrigger value="persons" className="px-4">
                        <Users aria-hidden="true" />
                        {t('syncHistory.tabs.persons')}
                    </TabsTrigger>
                    <TabsTrigger value="clears" className="px-4">
                        <Eraser aria-hidden="true" />
                        {t('syncHistory.tabs.clears')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="events">
                    <EventSyncHistorySection />
                </TabsContent>
                <TabsContent value="push">
                    <PushActivitySection />
                </TabsContent>
                <TabsContent value="persons">
                    <PersonSyncHistoryPage embedded />
                </TabsContent>
                <TabsContent value="clears">
                    <ClearHistorySection />
                </TabsContent>
            </Tabs>
        </div>
    );
}
