
import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
    archiveTerminal,
    restoreTerminal,
} from "@/lib/terminals-api";

import type { Terminal } from "@/types/terminal";

interface Props {
    terminal: Terminal;
    onChanged: () => void;
}

export function TerminalArchiveAction({
    terminal,
    onChanged,
}: Props) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const archived = Boolean(terminal.archivedAt);

    async function handleConfirm() {
        if (busy) return;

        setBusy(true);
        setError("");

        try {
            if (archived) {
                await restoreTerminal(terminal.id);
            } else {
                await archiveTerminal(terminal.id);
            }

            setOpen(false);
            onChanged();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Amalni bajarishda xatolik yuz berdi.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (busy) return;
                setError("");
                setOpen(next);
            }}
        >
            <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    {archived ? (
                        <ArchiveRestore aria-hidden="true" className="size-4" />
                    ) : (
                        <Archive aria-hidden="true" className="size-4" />
                    )}
                    {archived ? "Qayta tiklash" : "Arxivlash"}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {archived
                            ? "Terminalni arxivdan tiklash"
                            : "Terminalni arxivlash"}
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                        {terminal.name} (#{terminal.id}) —{" "}
                        {terminal.school.name}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2 text-sm">
                    {archived ? (
                        <p>
                            Terminal arxivdan chiqariladi, lekin avtomatik
                            faollashtirilmaydi. Ulanishni tekshirib,
                            keyin faollashtirishingiz mumkin.
                        </p>
                    ) : (
                        <p>
                            Terminal nofaol holatga o‘tkaziladi va
                            arxivlanadi. Davomat tarixi saqlanib qoladi.
                        </p>
                    )}
                </div>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>
                        Bekor qilish
                    </AlertDialogCancel>

                    <Button
                        type="button"
                        variant={archived ? "default" : "destructive"}
                        disabled={busy}
                        onClick={() => void handleConfirm()}
                    >
                        {busy
                            ? "Bajarilmoqda..."
                            : archived
                                ? "Qayta tiklash"
                                : "Arxivlashni tasdiqlash"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
