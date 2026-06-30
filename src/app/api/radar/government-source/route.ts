import { NextResponse } from "next/server";

import {
  detectGovernmentFormat,
  fetchGovernmentSourceText,
  parseGovernmentRows,
  transformGovernmentRow,
} from "@/lib/prospecting/government-source";
import type { ProspectRecord } from "@/lib/prospecting";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type RequestBody = {
  url?: string;
  targetCity?: string;
  limit?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const sourceUrl = body.url?.trim();
    const targetCity = body.targetCity?.trim() || "";
    const limit = Math.min(Math.max(Number(body.limit || DEFAULT_LIMIT), 1), MAX_LIMIT);

    if (!sourceUrl) {
      return NextResponse.json({ error: "L'URL du fichier public est requise." }, { status: 400 });
    }

    const { text, contentType } = await fetchGovernmentSourceText(sourceUrl);
    const rows = parseGovernmentRows(text, contentType, sourceUrl);
    const opportunities = rows
      .map((row, index) => transformGovernmentRow(row, index, { sourceUrl, targetCity }))
      .filter((item): item is ProspectRecord => Boolean(item))
      .slice(0, limit);

    const averageScore = Math.round(opportunities.reduce((total, item) => total + item.opportunityScore, 0) / Math.max(opportunities.length, 1));

    return NextResponse.json({
      opportunities,
      summary: {
        count: opportunities.length,
        averageScore,
        highPriority: opportunities.filter((item) => item.priority === "Élevée").length,
      },
      detectedFormat: detectGovernmentFormat(text, contentType, sourceUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La source gouvernementale n'a pas pu être analysée.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
