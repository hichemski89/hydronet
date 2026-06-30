/*
 * HydroNet — © 2026 NovaSoft — Tous droits réservés.
 * Pont sécurisé entre le renderer et le process principal pour la gestion
 * des licences (stockage chiffré via safeStorage, machineId hardware).
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronLicense', {
  getToken:      ()        => ipcRenderer.invoke('license:getToken'),
  setToken:      (token)   => ipcRenderer.invoke('license:setToken', token),
  clearToken:    ()        => ipcRenderer.invoke('license:clearToken'),
  getMachineId:  ()        => ipcRenderer.invoke('license:getMachineId'),
  getLastCheck:  ()        => ipcRenderer.invoke('license:getLastCheck'),
  setLastCheck:  (ts)      => ipcRenderer.invoke('license:setLastCheck', ts),
});

// Gestion de la fermeture de l'application (confirmation d'enregistrement).
contextBridge.exposeInMainWorld('electronApp', {
  // Le process principal demande la fermeture : on s'abonne pour répondre.
  onCloseRequest: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:close-request', handler);
    return () => ipcRenderer.removeListener('app:close-request', handler);
  },
  // Autorise la fermeture effective (après choix de l'utilisateur).
  confirmClose: () => ipcRenderer.send('app:confirm-close'),
});
