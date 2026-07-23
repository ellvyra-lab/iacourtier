export type AgencyBrand = {
  id: string;
  network: string;
  officialName: string;
  aliases: string[];
  domain: string;
  primaryColor: string;
  secondaryColor: string;
};

export const AGENCY_BRANDS: AgencyBrand[] = [
  { id: "via-capitale-parcours", network: "Via Capitale", officialName: "Via Capitale Parcours", aliases: ["parcours"], domain: "viacapitale.com", primaryColor: "#ef3e42", secondaryColor: "#202b5d" },
  { id: "via-capitale-expertise", network: "Via Capitale", officialName: "Via Capitale Expertise", aliases: ["expertise"], domain: "viacapitale.com", primaryColor: "#ef3e42", secondaryColor: "#202b5d" },
  { id: "via-capitale-elite", network: "Via Capitale", officialName: "Via Capitale Élite", aliases: ["elite", "élite"], domain: "viacapitale.com", primaryColor: "#ef3e42", secondaryColor: "#202b5d" },
  { id: "via-capitale-rive-nord", network: "Via Capitale", officialName: "Via Capitale Rive-Nord", aliases: ["rive nord", "rive-nord"], domain: "viacapitale.com", primaryColor: "#ef3e42", secondaryColor: "#202b5d" },
  { id: "remax-quebec", network: "RE/MAX", officialName: "RE/MAX Québec", aliases: ["remax", "re/max"], domain: "remax-quebec.com", primaryColor: "#dc1c2e", secondaryColor: "#003da5" },
  { id: "exp-realty-canada", network: "eXp", officialName: "eXp Realty Canada", aliases: ["exp", "exp realty"], domain: "exprealty.ca", primaryColor: "#f58220", secondaryColor: "#233746" },
  { id: "royal-lepage-canada", network: "Royal LePage", officialName: "Royal LePage", aliases: ["royal lepage"], domain: "royallepage.ca", primaryColor: "#cc0000", secondaryColor: "#111111" },
  { id: "sutton-quebec", network: "Sutton", officialName: "Groupe Sutton Québec", aliases: ["sutton"], domain: "groupesutton.com", primaryColor: "#d71920", secondaryColor: "#111111" },
  { id: "proprio-direct", network: "Proprio Direct", officialName: "Proprio Direct", aliases: ["proprio direct"], domain: "propriodirect.com", primaryColor: "#e31b23", secondaryColor: "#1f2937" },
  { id: "engel-volkers-canada", network: "Engel & Völkers", officialName: "Engel & Völkers Canada", aliases: ["engel", "volkers", "völkers"], domain: "engelvoelkers.com", primaryColor: "#b40019", secondaryColor: "#1a1a1a" },
];

export function agencyLogoUrl(agency: AgencyBrand) {
  return `https://www.google.com/s2/favicons?domain=${agency.domain}&sz=256`;
}

export function searchAgencyBrands(query: string) {
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!normalized) return AGENCY_BRANDS;
  return AGENCY_BRANDS.filter((agency) =>
    [agency.network, agency.officialName, ...agency.aliases]
      .some((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized)),
  );
}
