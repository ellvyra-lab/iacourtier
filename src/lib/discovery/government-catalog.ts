import type { MunicipalityCatalogEntry } from "./municipality";
import { normalizeMunicipalityName } from "./municipality";

const catalogEntries: MunicipalityCatalogEntry[] = [
  {
    municipality: {
      id: "repentigny",
      name: "Repentigny",
      normalizedName: "repentigny",
      province: "QC",
      region: "Lanaudiere",
      mrc: "L'Assomption",
    },
    sources: [
      {
        id: "repentigny-evaluation-role",
        label: "Repentigny - Role d'evaluation",
        domain: "evaluation",
        providerType: "montreal-evaluation",
        organization: "Ville de Repentigny",
        active: false,
        metadata: {
          expectedFormat: "XML",
          notes: "Brancher l'URL officielle du role d'evaluation lorsque publiee.",
        },
      },
      {
        id: "repentigny-permits",
        label: "Repentigny - Permis municipaux",
        domain: "permits",
        providerType: "repentigny-permits",
        organization: "Ville de Repentigny",
        active: true,
        metadata: {
          expectedFormat: "CSV/XML/API",
        },
      },
      {
        id: "repentigny-donnees-quebec",
        label: "Donnees Quebec - Repentigny",
        domain: "quebec",
        providerType: "donnees-quebec",
        organization: "Gouvernement du Quebec",
        active: true,
      },
      {
        id: "repentigny-avis-publics",
        label: "Repentigny - Avis publics",
        domain: "municipal",
        providerType: "generic-municipal",
        organization: "Ville de Repentigny",
        active: true,
      },
      {
        id: "repentigny-ventes-judiciaires",
        label: "Ventes judiciaires - Repentigny",
        domain: "judicial",
        providerType: "judicial-sales",
        active: true,
      },
    ],
  },
  {
    municipality: {
      id: "montreal",
      name: "Montreal",
      normalizedName: "montreal",
      province: "QC",
      region: "Montreal",
    },
    sources: [
      {
        id: "montreal-evaluation-role",
        label: "Montreal - Role d'evaluation",
        domain: "evaluation",
        providerType: "montreal-evaluation",
        organization: "Ville de Montreal",
        active: true,
        metadata: {
          expectedFormat: "XML",
        },
      },
      {
        id: "montreal-donnees-quebec",
        label: "Donnees Quebec - Montreal",
        domain: "quebec",
        providerType: "donnees-quebec",
        organization: "Gouvernement du Quebec",
        active: true,
      },
    ],
  },
];

export function getGovernmentCatalog() {
  return catalogEntries;
}

export function findMunicipalityCatalogEntry(city: string) {
  const normalized = normalizeMunicipalityName(city);
  return catalogEntries.find((entry) => entry.municipality.normalizedName === normalized || entry.municipality.id === normalized);
}

export function listSupportedMunicipalities() {
  return catalogEntries.map((entry) => entry.municipality);
}
