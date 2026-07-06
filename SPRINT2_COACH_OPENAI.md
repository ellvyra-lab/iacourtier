# Sprint 2 – Branchement du Coach de "Ma journée" à OpenAI

## ✅ Objectif réalisé

La page `/tableau-de-bord` (Ma journée) appelle maintenant OpenAI pour générer le message du Coach en temps réel au lieu d'utiliser du texte statique.

---

## 📝 Fichiers modifiés

### 1. **Création : `/src/app/api/coach/message/route.ts`**

Route API serveur qui génère le message du Coach avec OpenAI.

**Endpoint :**
```
POST /api/coach/message
```

**Request body :**
```json
{
  "userName": "Sonia",
  "plan": {
    "callsToMake": 5,
    "radarProspectsToCall": 3,
    "followupsDue": 2,
    "sellerAppointmentsToPrepare": 1,
    "marketAnalysesToPrepare": 1,
    "mandatesWithMissingDocuments": 0,
    "marketingActionsToGenerate": 0
  }
}
```

**Response :**
```json
{
  "greeting": "Bonjour Sonia 👋",
  "mainMessage": "Aujourd'hui, on va avancer. Je t'ai préparé ton plan de bataille.",
  "focus": "Un appel vaut mieux que dix idées.",
  "recommendation": "On garde ça simple : appels, relances, rendez-vous vendeurs, analyses de marché avant la rencontre, puis documents et mise en marché quand le mandat est signé."
}
```

**Fallback** : Si OpenAI échoue, la route retourne un message statique cohérent.

### 2. **Modification : `/src/components/sonia-beta/battle-plan-dashboard.tsx`**

Composant client qui consomme la route API.

**Changements :**
- ✅ Ajout de `coachMessage` state avec valeur initiale du fallback
- ✅ Ajout de `isLoadingMessage` state pour gérer le chargement
- ✅ `useEffect` qui appelle `/api/coach/message` en fonction du plan
- ✅ Remplacement du texte statique par `{coachMessage.greeting}`
- ✅ Remplacement du message principal par `{coachMessage.mainMessage}`
- ✅ Remplacement du focus par `{coachMessage.focus}`
- ✅ Remplacement du recommendation par `{coachMessage.recommendation}`

**Gestion des erreurs :**
- Si l'API échoue (404, 500, timeout, etc.), les valeurs statiques du fallback s'affichent
- Pas de rupture de l'expérience utilisateur

---

## 🧪 Tests

✓ Page `/tableau-de-bord` charge correctement
✓ Texte s'affiche (soit OpenAI, soit fallback)
✓ TypeScript : 0 erreurs
✓ Pas de modifications à d'autres pages
✓ API `/api/debug/openai` toujours fonctionnelle

---

## 🎯 Points clés

1. **OpenAI réel** : Le message est généré via OpenAI, pas statique
2. **Contexte dynamique** : OpenAI utilise les chiffres du plan (appels, relances, etc.)
3. **Fallback** : Si OpenAI échoue, l'app continue de fonctionner
4. **Pas d'impact** : Aucune autre page n'est affectée
5. **Sécurité** : API clé OpenAI reste côté serveur uniquement

---

## 📂 Fichiers modifiés à afficher à l'utilisateur

1. `src/app/api/coach/message/route.ts` (nouveau)
2. `src/components/sonia-beta/battle-plan-dashboard.tsx` (modifié)

