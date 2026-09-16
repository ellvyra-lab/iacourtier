export const CENTRIS_DIRECT_TRANSMISSION_MESSAGE =
  "La transmission directe sera disponible lorsqu’une connexion Centris autorisée sera configurée.";

export type CentrisConnectionStatus = {
  connected: false;
  mode: "preparation_only";
  label: string;
  message: string;
};

export function getCentrisConnectionStatus(): CentrisConnectionStatus {
  return {
    connected: false,
    mode: "preparation_only",
    label: "Non connectée",
    message: CENTRIS_DIRECT_TRANSMISSION_MESSAGE,
  };
}

export async function transmitCentrisListing(): Promise<never> {
  throw new Error(CENTRIS_DIRECT_TRANSMISSION_MESSAGE);
}
