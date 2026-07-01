# Providers officiels IACourtier

Le Radar ne consomme jamais directement une source publique. Il reçoit uniquement des `OfficialProperty` normalisées.

Chaque connecteur doit implémenter :

- `sync()`
- `fetch()`
- `normalize()`
- `validate()`
- `score()`

Exemple :

```ts
import { registerProvider } from "@/lib/providers";
import { MontrealEvaluationProvider } from "@/lib/providers/evaluation/montreal-evaluation-provider";
import { RepentignyPermitProvider } from "@/lib/providers/permits/repentigny-permit-provider";
import { DonneesQuebecProvider } from "@/lib/providers/government/donnees-quebec-provider";

registerProvider(new MontrealEvaluationProvider());
registerProvider(new RepentignyPermitProvider());
registerProvider(new DonneesQuebecProvider());
```

Une propriete = une seule fiche, enrichie par plusieurs sources. La fusion se fait avec `propertyKey`, basee sur le matricule, le lot, le cadastre, l'adresse normalisee et la ville.
