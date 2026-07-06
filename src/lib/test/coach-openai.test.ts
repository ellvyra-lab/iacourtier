import type { CoachFeedback, CoachScenarioId } from "@/lib/prospecting-coach";

/**
 * Exemple de test du composant ProspectingCoachDashboard
 * 
 * Quand ProspectingCoachDashboard sera utilisé dans l'app,
 * il appellera /api/coach/analyze qui utilise OpenAI pour générer
 * du feedback réel au lieu d'utiliser des regex statiques.
 */

export async function testCoachAnalyzeRoute() {
  const scenarios: CoachScenarioId[] = ["cold_seller", "past_client", "radar_owner"];

  for (const scenarioId of scenarios) {
    const testResponse = "Bonjour M. Tremblay, je suis Sonia Bernier, courtière immobilière. Je suis très active dans votre secteur et je voulais simplement vous poser une question : est-ce que vendre votre propriété cette année fait partie de vos réflexions?";

    try {
      const res = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: testResponse, scenarioId }),
      });

      if (!res.ok) {
        console.error(`❌ ${scenarioId} failed:`, res.status);
        const error = await res.json();
        console.error("Error:", error);
        continue;
      }

      const data = (await res.json()) as { feedback: CoachFeedback };
      console.log(`✓ ${scenarioId}:`);
      console.log(`  Score: ${data.feedback.score}/10`);
      console.log(`  Good: ${data.feedback.good}`);
      console.log(`  Weak: ${data.feedback.weak}`);
      console.log(`  Next question: ${data.feedback.nextBestQuestion}`);
      console.log("");
    } catch (err) {
      console.error(`❌ ${scenarioId} exception:`, err);
    }
  }
}

// Quand le composant est prêt à être utilisé, appeler testCoachAnalyzeRoute()
// et vérifier que les réponses OpenAI sont cohérentes et utiles

/**
 * Structure attendue de CoachFeedback:
 * {
 *   score: number (1-10),
 *   good: string,
 *   weak: string,
 *   topSellerAnswer: string,
 *   nextBestQuestion: string,
 *   checks: {
 *     natural: boolean,
 *     strongQuestion: boolean,
 *     curiosity: boolean,
 *     appointment: boolean,
 *     tooAggressive: boolean,
 *     tooSoft: boolean
 *   }
 * }
 */
