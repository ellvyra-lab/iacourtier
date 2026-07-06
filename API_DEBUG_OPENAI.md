# Test de l'intégration OpenAI

## Routes disponibles

### 1. GET /api/debug/openai
Vérifie la configuration et la connexion à OpenAI.

**Réponse (OK):**
```json
{
  "hasKey": true,
  "model": "gpt-4o-mini",
  "status": "ok",
  "test": "L'intégration d'OpenAI fonctionne."
}
```

**Réponse (Erreur - clé manquante):**
```json
{
  "hasKey": false,
  "model": null,
  "status": "error",
  "message": "OPENAI_API_KEY not configured",
  "diagnostic": "missing_api_key"
}
```

**Utilisation:**
```bash
curl http://localhost:3000/api/debug/openai
```

---

### 2. POST /api/coach/analyze
Analyse une réponse de prospect avec OpenAI et retourne du feedback détaillé.

**Payload:**
```json
{
  "response": "Bonjour, c'est Sonia Bernier. Est-ce que vendre cette année fait partie de vos plans?",
  "scenarioId": "cold_seller"
}
```

**Réponse (OK):**
```json
{
  "feedback": {
    "score": 8,
    "good": "Bon ton naturel et professionnel. Bonne question ouverte.",
    "weak": "",
    "topSellerAnswer": "Example réponse d'expert...",
    "nextBestQuestion": "Qu'est-ce qui vous ferait considérer une vente?",
    "checks": {
      "natural": true,
      "strongQuestion": true,
      "curiosity": false,
      "appointment": false,
      "tooAggressive": false,
      "tooSoft": false
    }
  }
}
```

**Scénarios disponibles:**
- `cold_seller` - Vendeur froid (inconnu)
- `past_client` - Ancien client
- `radar_owner` - Propriétaire Radar
- `fsbo` - FSBO / proprio vendeur
- `expired` - Propriété expirée
- `hesitant_seller` - Vendeur hésitant

**Utilisation (PowerShell):**
```powershell
$body = @{
  response = "Bonjour, c'est Sonia. Je suis courtière immobilière et je travaille dans votre secteur. Avez-vous un projet immobilier?"
  scenarioId = "cold_seller"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/coach/analyze `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**Utilisation (curl):**
```bash
curl -X POST http://localhost:3000/api/coach/analyze \
  -H "Content-Type: application/json" \
  -d '{"response":"Bonjour Sonia Bernier, je suis courtière","scenarioId":"cold_seller"}'
```

---

## Vérifications effectuées

✓ OPENAI_API_KEY est lue côté serveur uniquement
✓ Aucune clé API n'est jamais affichée au client
✓ Validation du format de la clé (commence par `sk-`)
✓ Gestion des erreurs avec diagnostics

✓ Route /api/debug/openai teste la connexion
✓ Route /api/coach/analyze utilise OpenAI pour générer du feedback
✓ ProspectingCoachDashboard modifié pour utiliser l'API

✓ Toutes les routes existantes continuent de fonctionner
✓ Pas de TypeScript errors

---

## Logs disponibles

Consulter les logs du serveur pour les erreurs OpenAI :
- `process.env.OPENAI_API_KEY` validation
- Détails des appels OpenAI échoués
- Messages d'erreur détaillés avec diagnostic

