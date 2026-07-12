import type { Metadata } from "next";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import {
  getCalendarComments,
  getCalendarItems,
  getCalendarOptions,
} from "@/services/calendar";

export const metadata: Metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

function operationalDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; date?: string }>;
}) {
  await requireAdmin();
  const today = operationalDate();
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 6);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 18);
  const params = await searchParams;
  const [items, options] = await Promise.all([
    getCalendarItems(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    ),
    getCalendarOptions(),
  ]);
  const selected = params.item
    ? (items.find(
        (item) =>
          item.id === params.item &&
          (!params.date || item.occurrenceDate === params.date),
      ) ?? null)
    : null;
  const comments = selected ? await getCalendarComments(selected.id) : [];
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin workspace"
        title="Calendario"
        description="Organiza tareas, actividades, recordatorios y mensajes internos del equipo Sinexia."
      />
      <CalendarBoard
        items={items}
        companies={options.companies}
        admins={options.admins}
        initialDate={today}
        selectedItem={selected}
        comments={comments}
      />
    </div>
  );
}
