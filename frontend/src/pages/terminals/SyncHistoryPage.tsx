
import { useSearchParams } from "react-router";
import { CalendarClock, Users } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { EventSyncHistorySection } from "./EventSyncHistorySection";
import { PersonSyncHistoryPage } from "./PersonSyncHistoryPage";

export function SyncHistoryPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const tab =
        searchParams.get("tab") === "persons"
            ? "persons"
            : "events";

    function changeTab(next: "events" | "persons") {
        setSearchParams(next === "events" ? {} : { tab: next });
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="E-Davomat / Hikvision"
                title="Terminallar sinxronlash tarixi"
                description="Davomat eventlarini olish va shaxslarni terminallarga yuborish jarayonlari."
            />

            <div className="flex flex-wrap gap-2 border-b pb-3">
                <Button
                    type="button"
                    variant={tab === "events" ? "default" : "outline"}
                    onClick={() => changeTab("events")}
                >
                    <CalendarClock className="size-4" />
                    Davomat eventlari
                </Button>

                <Button
                    type="button"
                    variant={tab === "persons" ? "default" : "outline"}
                    onClick={() => changeTab("persons")}
                >
                    <Users className="size-4" />
                    Shaxslar sinxronlash tarixi
                </Button>
            </div>

            {tab === "events" ? (
                <EventSyncHistorySection />
            ) : (
                <PersonSyncHistoryPage embedded />
            )}
        </div>
    );
}
