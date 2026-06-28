"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AccountSettingsForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user) {
        setName((user.user_metadata?.full_name as string) || "");
        setEmail(user.email || "");
      }
      setLoadingProfile(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    setProfileSaved(false);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    setSavingProfile(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSavingPassword(true);
    setError("");
    setPasswordSaved(false);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNewPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form
        onSubmit={handleProfileSave}
        className="rounded-2xl border border-subtle bg-surface-soft p-6"
      >
        <p className="mb-4 font-semibold">Informations du compte</p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Nom complet</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loadingProfile}
              className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Courriel</label>
            <input
              value={email}
              disabled
              className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm text-muted outline-none"
            />
            <p className="text-xs text-muted">
              Pour changer de courriel, contactez le support.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={savingProfile || loadingProfile}
          className="mt-4 flex items-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white"
        >
          {savingProfile ? (
            <Loader2 size={14} className="animate-spin" />
          ) : profileSaved ? (
            <Check size={14} />
          ) : null}
          {profileSaved ? "Enregistré" : "Enregistrer"}
        </button>
      </form>

      <form
        onSubmit={handlePasswordSave}
        className="rounded-2xl border border-subtle bg-surface-soft p-6"
      >
        <p className="mb-4 font-semibold">Changer de mot de passe</p>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Nouveau mot de passe</label>
          <input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6 caractères minimum"
            className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
        <button
          type="submit"
          disabled={savingPassword || !newPassword}
          className="mt-4 flex items-center gap-2 rounded-full border border-subtle px-5 py-2.5 text-sm hover:border-electric-500 hover:text-electric-500 disabled:opacity-50"
        >
          {savingPassword ? (
            <Loader2 size={14} className="animate-spin" />
          ) : passwordSaved ? (
            <Check size={14} />
          ) : null}
          {passwordSaved ? "Mot de passe mis à jour" : "Mettre à jour"}
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="mb-4 font-semibold">Abonnement</p>
        <p className="text-sm text-muted">
          Gérez votre forfait, vos générations restantes et votre facturation.
        </p>
        <a
          href="/tableau-de-bord/abonnement"
          className="mt-4 inline-block rounded-full border border-subtle px-4 py-2 text-sm hover:border-electric-500 hover:text-electric-500"
        >
          Voir mon abonnement
        </a>
      </div>
    </div>
  );
}
