# Discovery Engine Quebec

Le Radar ne connait jamais les URL ni les catalogues publics.

Il demande seulement :

```ts
import { getCityOpportunities } from "@/lib/discovery";

const result = await getCityOpportunities("Repentigny");
```

Le moteur :

1. trouve la ville dans `government-catalog.ts`;
2. charge les sources publiques connues;
3. cree les providers officiels;
4. execute `sync()`;
5. normalise les proprietes;
6. fusionne et deduplique les fiches;
7. retourne `OfficialProperty[]`.

Pour ajouter une ville, ajouter une entree dans `government-catalog.ts`.

Pour ajouter une nouvelle source, ajouter un provider dans `src/lib/providers/`, puis le mapper dans `providers/provider-factory.ts`.
