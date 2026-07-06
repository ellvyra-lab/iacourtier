# 📋 Fichiers modifiés – Sprint 2

## ✅ Tâche complétée : Coach "Ma journée" branchée à OpenAI

La page `/tableau-de-bord` appelle maintenant **OpenAI en temps réel** pour générer le message du Coach.

---

## 🆕 FICHIER CRÉÉ

### `src/app/api/coach/message/route.ts`

**Fonction :** Route API serveur qui génère le message du Coach dynamiquement.

**Endpoint :** `POST /api/coach/message`

**Logique :**
1. Reçoit le plan de la journée (appels, relances, rendez-vous, etc.)
2. Envoie un prompt à OpenAI avec contexte du jour
3. Retourne 4 champs : `greeting`, `mainMessage`, `focus`, `recommendation`
4. Fallback : Si OpenAI échoue, retourne un message statique

**Points clés :**
- Utilise `generateWithOpenAI()` de `src/lib/openai.ts`
- Gestion d'erreurs complète
- Parsing JSON robuste

---

## ✏️ FICHIER MODIFIÉ

### `src/components/sonia-beta/battle-plan-dashboard.tsx`

**Changements :**

1. **Imports ajoutés :**
   ```typescript
   import type { CoachMessageResponse } from "@/app/api/coach/message/route";
   ```

2. **State ajoutés :**
   ```typescript
   const [coachMessage, setCoachMessage] = useState<CoachMessageResponse>(fallbackCoachMessage);
   const [isLoadingMessage, setIsLoadingMessage] = useState(false);
   ```

3. **Effect pour appeler l'API :**
   ```typescript
   useEffect(() => {
     async function fetchCoachMessage() {
       setIsLoadingMessage(true);
       try {
         const res = await fetch("/api/coach/message", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             userName: "Sonia",
             plan: {
               callsToMake: plan.callsToMake.length,
               radarProspectsToCall: plan.radarProspectsToCall.length,
               followupsDue: plan.followupsDue.length,
               // ... autres champs du plan
             },
           }),
         });
         if (res.ok) {
           const data = await res.json();
           setCoachMessage(data);
         }
       } catch (err) {
         console.error("Error fetching coach message:", err);
       } finally {
         setIsLoadingMessage(false);
       }
     }
     fetchCoachMessage();
   }, [plan]);
   ```

4. **Variables dynamiques dans le JSX :**
   - `{coachMessage.greeting}` → "Bonjour Sonia 👋" (généré)
   - `{coachMessage.mainMessage}` → Message principal (généré)
   - `{coachMessage.focus}` → Focus du jour (généré)
   - `{coachMessage.recommendation}` → Recommendation (généré)

5. **Fallback statique :**
   ```typescript
   const fallbackCoachMessage: CoachMessageResponse = {
     greeting: "Bonjour Sonia 👋",
     mainMessage: "Aujourd'hui, on va avancer. Je t'ai préparé ton plan de bataille.",
     focus: "Un appel vaut mieux que dix idées.",
     recommendation: "On garde ça simple : ...",
   };
   ```

---

## ✅ Vérifications

| Critère | Résultat |
|---------|----------|
| Page `/tableau-de-bord` charge | ✓ OK |
| Texte s'affiche | ✓ OK |
| Appel API `/api/coach/message` | ✓ Fonctionne |
| Fallback si erreur | ✓ Actif |
| TypeScript errors | ✓ 0 erreurs |
| Autres pages affectées | ✓ Non |

---

## 🎯 Comportement

**Avant (Sprint 1):** Texte statique
```
"Bonjour Sonia 👋"
"Aujourd'hui, on va avancer. Je t'ai préparé ton plan de bataille."
"Un appel vaut mieux que dix idées."
```

**Après (Sprint 2):** Dynamique via OpenAI
```
- OpenAI génère un greeting personnalisé basé sur le jour
- OpenAI génère un message principal basé sur le plan du jour
- OpenAI génère un focus inspirant basé sur les priorités
- OpenAI génère une recommendation d'action basée sur les prospects
```

---

## 🔄 Dépendances

- `src/lib/openai.ts` → `generateWithOpenAI()` (existant)
- `src/lib/sonia-beta.ts` → `buildSoniaBattlePlan()` (existant)
- OpenAI API key (côté serveur)

