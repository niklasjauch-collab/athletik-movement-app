import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import PlanEditor from "./PlanEditor";
import PlanActions from "./PlanActions";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  TEMPLATE: "Template",
  INDIVIDUAL: "Kundenplan",
  SELLABLE: "Shop-Plan",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

// CoachAdmin briefing §33 PLAN BUILDER (edit) + §34/§35/§38 action buttons.
export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const plan = await prisma.trainingPlan.findFirst({
    where: { id, providerId: provider.id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      assignedFromTemplate: { select: { id: true, title: true } },
      items: { orderBy: { order: "asc" }, include: { exercise: true } },
    },
  });
  if (!plan) notFound();

  const [exercises, clients] = await Promise.all([
    prisma.exercise.findMany({
      where: { providerId: provider.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        correctivePhase: true,
        muscleGroups: true,
        equipment: true,
        unit: true,
        sets: true,
        pauseSeconds: true,
        isPublished: true,
        videoMaleUrl: true,
        videoFemaleUrl: true,
        videoMalePath: true,
        videoFemalePath: true,
      },
    }),
    prisma.client.findMany({
      where: { providerId: provider.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
      take: 500,
    }),
  ]);

  return (
    <main className="flex-1 px-6 py-10 max-w-4xl mx-auto pb-24">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/plans" className="hover:underline">
          ← Trainingspläne
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">{plan.title}</h1>
          <p className="mt-1 text-sm text-ink-700/70">
            {KIND_LABELS[plan.kind] ?? plan.kind}
            {plan.client && (
              <>
                {" · "}
                <Link href={`/admin/customers/${plan.client.id}`} className="underline hover:text-brand-700">
                  {plan.client.firstName} {plan.client.lastName}
                </Link>
              </>
            )}
            {plan.assignedFromTemplate && (
              <>
                {" · aus Template "}
                <Link href={`/admin/plans/${plan.assignedFromTemplate.id}`} className="underline hover:text-brand-700">
                  {plan.assignedFromTemplate.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            plan.status === "PUBLISHED"
              ? "bg-brand-100 text-brand-700"
              : plan.status === "ARCHIVED"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {STATUS_LABELS[plan.status] ?? plan.status}
        </span>
      </div>

      <div className="mt-4">
        <PlanActions planId={plan.id} status={plan.status} kind={plan.kind} clients={clients} />
      </div>

      <PlanEditor
        planId={plan.id}
        initial={{
          title: plan.title,
          description: plan.description,
          goal: plan.goal,
          durationWeeks: plan.durationWeeks,
          frequencyPerWeek: plan.frequencyPerWeek,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
          items: plan.items.map((i: any) => ({
            exerciseId: i.exerciseId,
            setsOverride: i.setsOverride,
            pauseSecondsOverride: i.pauseSecondsOverride,
            notes: i.notes,
          })),
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
        exercises={exercises.map((e: any) => ({
          id: e.id,
          name: e.name,
          correctivePhase: e.correctivePhase,
          muscleGroups: e.muscleGroups,
          equipment: e.equipment,
          unit: e.unit,
          sets: e.sets,
          pauseSeconds: e.pauseSeconds,
          isPublished: e.isPublished,
          hasVideo: Boolean(e.videoMaleUrl || e.videoFemaleUrl || e.videoMalePath || e.videoFemalePath),
        }))}
      />
    </main>
  );
}
