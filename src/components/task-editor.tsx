"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
export function TaskEditor({ id, title, dueOn }: { id: string; title: string; dueOn: string | null }) {
  const { authenticatedFetch } = useDashboardAuth();
  const router = useRouter();
  const [name, setName] = useState(title), [date, setDate] = useState(dueOn || ""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  return <form id="modifier" className="space-y-3" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await authenticatedFetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: name, dueOn: date || null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setNotice("Tâche modifiée."); window.dispatchEvent(new Event("crm-updated")); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Modification impossible."); } finally { setBusy(false); }
  }}><label className="block">Titre<input required maxLength={240} value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-xl border bg-transparent p-3" /></label><label className="block">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="block rounded-xl border bg-transparent p-3" /></label><button disabled={busy} className="rounded-xl border px-4 py-2">Enregistrer les modifications</button><p role="status">{notice}</p></form>;
}
