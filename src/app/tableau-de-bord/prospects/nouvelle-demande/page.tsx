"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createProspectFromInformationRequest, type InformationRequestChannel } from "@/lib/sonia-beta/storage";

const channels: InformationRequestChannel[] = ["Facebook", "Messenger", "Centris", "Courriel", "Téléphone"];

const conversationKey = () => `iacourtier_coach_conversation_${new Date().toISOString().slice(0, 10)}`;

function notifyCoachOfNewProspect(prospect: { id: string; name: string; address: string }) {
  if (typeof window === "undefined") return;

  const message = {
    id: `prospect-created-${prospect.id}`,
    text: "Nouveau prospect créé.",
    createdAt: new Date().toISOString(),
    tone: "win",
    actionLabel: "📞 Préparer le premier appel",
    actionHref: `/tableau-de-bord/actions/prepare-first-seller-call?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&context=prospect`,
  };

  try {
    const raw = window.localStorage.getItem(conversationKey());
    const current = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(current) ? [...current, message] : [message];
    window.localStorage.setItem(conversationKey(), JSON.stringify(next.slice(-30)));
  } catch {
    window.localStorage.setItem(conversationKey(), JSON.stringify([message]));
  }
}

export default function NouvelleDemandeInformationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<InformationRequestChannel>("Facebook");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const prospect = createProspectFromInformationRequest({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      message: message.trim(),
      channel,
    });

    notifyCoachOfNewProspect(prospect);
    router.push("/tableau-de-bord/coach");
  }

  return (
    <div className="space-y-7">
      <Link href="/tableau-de-bord/prospects" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300">
        ← Retour aux prospects
      </Link>

      <div>
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Nouveau prospect</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Nouvelle demande d&apos;information</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Consigne les informations reçues pour créer automatiquement une fiche prospect.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <Field label="Nom" required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>

        <Field label="Téléphone">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>

        <Field label="Courriel">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>

        <Field label="Adresse recherchée">
          <input
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>

        <Field label="Message reçu">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>

        <Field label="Source">
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as InformationRequestChannel)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {channels.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          Créer le prospect
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
