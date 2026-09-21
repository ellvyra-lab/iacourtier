"use client";

import { CoachLauncher } from "@/components/coach-conversation";

/** Voice and text share the same conversation, tools, context and audit trail. */
export function UniversalQuickCapture({ floating = false }: { floating?: boolean }) {
  return <CoachLauncher floating={floating} />;
}
