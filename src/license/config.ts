// Configuration de l'activation par licence.
//
// Tant que ENABLED = false, l'application fonctionne normalement sans clé
// (utile en développement). Passez ENABLED à true quand votre serveur de
// licences est en ligne et que vous avez collé la clé publique ci-dessous.
export const LICENSE = {
  /** Active l'écran d'activation et la vérification de licence. */
  ENABLED: false,
  /** URL publique de votre serveur de licences (sans / final). */
  SERVER_URL: 'https://VOTRE-serveur-licences.onrender.com',
  /** Doit correspondre au PRODUCT du serveur. */
  PRODUCT: 'HydroNet',
  /** Clé publique Ed25519 (SPKI base64) produite par `npm run keygen`. */
  PUBLIC_KEY_B64: 'COLLEZ_ICI_LA_CLE_PUBLIQUE',
  /** Délai avant re-vérification en ligne (jours). */
  RECHECK_DAYS: 30,
  /** Tolérance hors-ligne au-delà du délai de re-vérification (jours). */
  OFFLINE_GRACE_DAYS: 30,
};
