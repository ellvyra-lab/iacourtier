import { notFound } from "next/navigation";
import { assistantsConfig, getAssistantConfig } from "@/data/assistantsConfig";
import { AssistantRunner } from "@/components/dashboard/AssistantRunner";

export function generateStaticParams() {
  return assistantsConfig.map((a) => ({ slug: a.slug }));
}

export default function AssistantPage({ params }: { params: { slug: string } }) {
  const assistant = getAssistantConfig(params.slug);
  if (!assistant) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-2xl">
          {assistant.emoji}
        </span>
        <div>
          <p className="text-lg font-semibold">{assistant.title}</p>
          <p className="text-sm text-electric-500">{assistant.result}</p>
        </div>
      </div>

      <AssistantRunner assistant={assistant} />
    </div>
  );
}
