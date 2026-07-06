"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { buildCoachTasks, getNextBestTask, markTaskCompleted, type CoachTask } from "@/lib/coach/task-engine";
import type { DailyCoachPlan } from "@/lib/coach/daily-coach";

export function CoachTaskEngine({ battlePlan }: { battlePlan: DailyCoachPlan["battlePlan"] }) {
  const baseTasks = useMemo(() => buildCoachTasks(battlePlan), [battlePlan]);
  const [tasks, setTasks] = useState<CoachTask[]>(baseTasks);

  useEffect(() => {
    setTasks(baseTasks);
  }, [baseTasks]);

  const nextTask = useMemo(() => getNextBestTask(tasks), [tasks]);

  function completeCurrentTask() {
    if (!nextTask) return;
    setTasks((current) => markTaskCompleted(current, nextTask.id));
  }

  return (
    <aside className="rounded-2xl border border-subtle bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950">
      <p className="flex items-center gap-2 text-sm font-semibold text-white/75 dark:text-slate-600">
        <Sparkles className="h-4 w-4" />
        Prochaine meilleure action
      </p>

      {nextTask ? (
        <div className="mt-4 space-y-4">
          <h2 className="text-2xl font-semibold leading-tight">{nextTask.title}</h2>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-600">
            <p>
              <span className="font-semibold">Priorite :</span> {nextTask.priority}
            </p>
            <p>
              <span className="font-semibold">Type :</span> {nextTask.type}
            </p>
            <p>
              <span className="font-semibold">Statut :</span> {nextTask.status}
            </p>
            <p>
              <span className="font-semibold">Action :</span> {nextTask.action}
            </p>
          </div>

          <Link
            href={nextTask.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 dark:bg-slate-950 dark:text-white"
          >
            {nextTask.action}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={completeCurrentTask}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-transparent px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 dark:border-slate-300 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <CheckCircle2 className="h-4 w-4" />
            Marquer comme completee
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-600">
          Toutes les taches du Coach sont completees. Reviens plus tard pour la prochaine mission.
        </div>
      )}
    </aside>
  );
}
