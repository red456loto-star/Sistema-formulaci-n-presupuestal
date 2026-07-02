import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("presucontrol", {
  getApiBaseUrl: () => ipcRenderer.invoke("presucontrol:get-api-base-url") as Promise<string>,
  showError: (title: string, message: string) => ipcRenderer.invoke("presucontrol:show-error", title, message) as Promise<void>,
});
