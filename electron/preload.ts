import { contextBridge } from 'electron';

// Expose safe, read-only system and runtime version attributes to client
contextBridge.exposeInMainWorld('lrmsDesktop', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  }
});
