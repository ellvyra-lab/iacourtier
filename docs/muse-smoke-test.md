# Test serveur Muse Spark

Script local uniquement (Node 20.12+), sans route publique ni accès CRM :

```powershell
node scripts/test-muse.mjs
# Ou fournir explicitement le fichier de configuration local :
node scripts/test-muse.mjs 'C:/chemin/vers/.env.local'
```

Variables requises : `MODEL_API_KEY`, `META_MODEL`, `META_BASE_URL`.
Ne jamais versionner le fichier de configuration ni utiliser un préfixe `NEXT_PUBLIC_`.
Le script utilise la clé uniquement dans l'en-tête serveur Authorization, refuse les redirections et les destinations autres que l'API officielle Meta, masque la clé dans toute sortie et impose un délai maximal de 60 secondes. Les variables déjà présentes dans le processus priment sur celles du fichier.

Prompt envoyé : « Réponds uniquement : Muse connecté à IACourtier. »

Résultat réel du 3 octobre 2026 :

- Endpoint : `https://api.meta.ai/v1/chat/completions`
- Modèle demandé : `muse-spark-1.3`
- HTTP 402, type `billing_error`, code `billing_not_configured`
- Message Meta : `Billing verification failed. Please check your payment method.`
- Aucune génération réussie ; aucun modèle retourné par Meta.

Nouveau test réel du 6 octobre 2026 : HTTP 200, modèle demandé et retourné `muse-spark-1.3`, réponse exacte : `Muse connecté à IACourtier`.

Un deuxième appel réseau réel via le nouveau provider Meta a reçu la même réponse. Le test automatisé `node --test scripts/ai-provider.test.mjs` vérifie séparément le choix par défaut, la sélection explicite de Meta, les erreurs HTTP/réseau, les réponses vides et le masquage de la clé avec des fixtures synthétiques.

Validation locale du 6 octobre : test automatisé réussi. `npm run build` a été exécuté mais reste bloqué par Windows (`EPERM`, création de répertoires `.next`), y compris après mise à l'écart du cache et dans une copie de compilation séparée. Ne pas considérer ce build comme validé.

Abstraction serveur minimale : `src/lib/server/ai-provider.ts`. `getAIProvider()` utilise le wrapper OpenAI existant ; `getAIProvider('meta')` sélectionne explicitement Muse. Les deux exposent `generate({ systemPrompt, userPrompt, maxTokens?, temperature?, jsonMode? })`. Pas de bascule automatique ni de connexion au Coach. Les erreurs Meta sont remontées avec leur statut, les secrets sont masqués. Les variables Meta sont lues uniquement lors de la sélection Meta ; OpenAI fonctionne sans elles.

Documentation officielle : https://dev.meta.ai/docs/cookbook/quickstart-chat-completions
