# Création de tâches Coach — diagnostic du 6 octobre 2026

## Défauts reproduits localement

- `create_task` exigeait un dossier dès qu'un client était résolu.
- La migration centrale définit `tasks.case_id NOT NULL` et aucune migration antérieure du dépôt ne retire cette contrainte. PostgreSQL local reproduit l'erreur `23502` pour une tâche personnelle.
- Les objets d'erreur Supabase n'étant pas des instances d'Error, le traitement affichait un message générique et perdait le diagnostic technique.
- Un appel réel au routeur OpenAI omettait parfois la référence Martin/Jacques et une partie du titre. Après clarification du prompt, les cinq phrases de test ont donné `create_task`, les noms et dates attendus.
- Les liens Ma journée/Tâches pointaient vers un catalogue de missions ne lisant pas `tasks`. La fiche client filtrait les tâches uniquement par dossier.

## Correction

Migration `202610061200_personal_crm_tasks.sql` : rend uniquement `case_id` nullable dans la table centrale, sans modifier les policies RLS. Aucun nouveau système de tâches.

Le tool accepte un client sans dossier, propose les homonymes et demande confirmation si le contact est absent. Les tâches personnelles explicites effacent les anciennes associations conversationnelles. La date sans heure utilise le fuseau fourni par le navigateur, validé côté serveur. Les expressions après-midi/semaine sont acceptées. Les heures explicites restent interprétées avec le service de dates Toronto existant.

Journalisation serveur sans contenu CRM : outil, présence des paramètres et associations, résultat, code d'erreur SQL. Les messages utilisateur ne révèlent pas les erreurs SQL.

Ma journée/Tâches et la fiche client lisent la table centrale. L'événement `crm-updated` et `router.refresh()` existants actualisent les données sans rechargement complet. La fiche tâche permet de modifier titre/date dans la même table.

## Vérification et limites

16 tests de contrat passent ; un test PostgreSQL local supplémentaire reproduit la contrainte, applique la migration deux fois, écrit/relit une tâche et vérifie l'isolation RLS. Cela ne constitue PAS une validation Supabase de production.

Sessions IACourtier et Supabase déconnectées : aucune migration distante appliquée et aucune tâche réelle persistée dans Supabase pendant ce diagnostic. La cause exacte de la requête historique reste à confirmer dans la base/logs. Ne pas annoncer ce bug corrigé en production avant cette vérification.

Test production requis : se connecter, appliquer la migration au projet `yvgxipnfpylrktjyyjts`, envoyer la phrase Martin, résoudre les éventuels choix, vérifier l'ID et la date dans `tasks`, Ma journée, Tâches et la fiche client. Vérifier aussi le rappel personnel, le refresh et l'absence de doublon.
