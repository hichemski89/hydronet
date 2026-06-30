/** API exposée par le preload Electron via contextBridge. */
interface ElectronLicenseAPI {
  getToken():              Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken():            Promise<void>;
  getMachineId():          Promise<string>;
  getLastCheck():          Promise<string | null>;
  setLastCheck(ts: string): Promise<void>;
}

/** API exposée par le preload pour la gestion de la fermeture de l'application. */
interface ElectronAppAPI {
  /** S'abonne à la demande de fermeture du process principal. Renvoie un désabonnement. */
  onCloseRequest(cb: () => void): () => void;
  /** Confirme la fermeture effective de l'application. */
  confirmClose(): void;
}

declare global {
  interface Window {
    electronLicense?: ElectronLicenseAPI;
    electronApp?: ElectronAppAPI;
  }
}

export {};
