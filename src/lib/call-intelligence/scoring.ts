export function clampCallScore(score: number) {
  return Math.max(1, Math.min(10, Math.round(score)));
}

export function scoreDiscovery(openQuestions: number, motivationDetected: boolean) {
  return clampCallScore(3 + openQuestions * 2 + (motivationDetected ? 2 : 0));
}

export function scoreConnection(transcript: string) {
  const lower = transcript.toLowerCase();
  let score = 5;
  if (/je comprends|bonne question|c'est normal|je respecte|sans pression/.test(lower)) score += 2;
  if (/vous devez|grave erreur|tout de suite|dernière chance/.test(lower)) score -= 2;
  return clampCallScore(score);
}

export function scoreObjectionHandling(objections: string[], transcript: string) {
  if (!objections.length) return 7;
  const lower = transcript.toLowerCase();
  const handled = /je comprends|justement|bonne raison|parfait|aucun problème/.test(lower);
  return clampCallScore(handled ? 8 : 4);
}

export function scoreClosing(appointmentAskDetected: boolean, nextStepDetected: boolean) {
  return clampCallScore(3 + (appointmentAskDetected ? 4 : 0) + (nextStepDetected ? 3 : 0));
}
