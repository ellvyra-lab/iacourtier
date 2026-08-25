# Ticket maître #049 — audit CRM et trajectoire de consolidation

Date de l’audit : 2026-08-25

## État réellement connecté avant le ticket #049

| Domaine | Source centrale | Structures spécialisées encore synchronisées | État |
| --- | --- | --- | --- |
| Personnes | `clients` | aucune requête applicative vers `seller_contacts` ou `buyer_contacts` | centralisé |
| Dossiers | `client_cases` | `buyer_cases`, `seller_listings` | central avec adaptateurs hérités |
| Participants | `client_case_clients` | `buyer_case_parties`, `seller_listing_parties` | central avec synchronisation |
| Propriétés | `properties`, `client_properties` | `property_id` dans les dossiers spécialisés | centralisé |
| Documents | `documents` | documents acheteur et vendeur | central avec provenance héritée |
| Tâches | `tasks` | tâches acheteur et vendeur | central avec synchronisation |
| Automatisations | `automations` | automatisations acheteur et vendeur | central, aucune diffusion sans approbation |
| Communications | `communications` | quelques modules de conversation isolés | central partiel |
| Rendez-vous | `appointments` | calendrier externe non branché | central interne |
| Provenance | `crm_facts`, `data_conflicts`, `data_corrections` | faits spécialisés acheteur/vendeur | central avec historique |
| Import | `/api/universal-import/*`, `/api/client-import/*` | aucune dépendance à `seller_contacts` | universel |

## Problèmes structurants trouvés

1. Les étapes et prochaines actions étaient codées dans plusieurs fichiers avec des listes différentes.
2. `progress` mélangeait position dans le pipeline et complétude des données.
3. Aucun journal événementiel central ne reliait les changements de pipeline, documents et moteurs futurs.
4. Les exigences d’une étape n’étaient ni persistées ni calculées par un moteur commun.
5. Les dossiers achat + vente n’avaient pas de modèle de dépendance explicite.
6. Le cockpit utilisait surtout l’ordre des tâches, sans score central de priorité ou de santé.
7. Les corrections humaines avaient une provenance, mais pas encore un registre d’audit dédié et prioritaire.

## Modèle central retenu

Le modèle canonique reste non destructif :

`clients → client_cases → properties → current_stage → case_requirements → tasks → documents → communications → crm_events`

Les tables spécialisées restent temporairement des adaptateurs de compatibilité. Toute nouvelle logique transversale doit utiliser `client_cases`, les objets CRM centraux et `src/lib/crm-operating-system.ts`. Aucune nouvelle table de personnes parallèle n’est permise.

## Séparation obligatoire des scores

- `pipeline_progress` : position de l’étape courante dans le parcours.
- `completion_score` : exigences connues satisfaites pour les étapes atteintes.
- `health_score` : retards, conflits et inactivité.
- `priority_score` : urgence opérationnelle, proximité de clôture et retards.

## Ordre d’implémentation

1. Fondations : schéma, relations, provenance, déduplication, RLS.
2. Pipelines : 14 étapes vendeur, 16 étapes acheteur, exigences, tâches et événements.
3. Import intelligent : alimenter ces moteurs après chaque source.
4. Cockpit : utiliser priorité, santé, complétude et prochaine action.
5. Coach IA, automatisations et marketing : consommer les mêmes événements, sans envoi automatique.

Les intégrations calendrier externe, courriel/SMS, transaction notariale et campagnes marketing demeurent des phases de connexion; elles ne doivent pas être simulées comme actives.

