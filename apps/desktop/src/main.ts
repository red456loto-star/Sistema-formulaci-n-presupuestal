import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";

interface StartedApi {
  url: string;
  close: () => Promise<void>;
}

let mainWindow: BrowserWindow | null = null;
let apiInstance: StartedApi | null = null;
let apiBaseUrl = process.env.PRESUCONTROL_API_URL || "http://127.0.0.1:4310";

async function startPackagedApi() {
  if (!app.isPackaged) return;
  const apiModulePath = path.join(app.getAppPath(), "apps", "api", "dist", "server.cjs");
  const apiModule = require(apiModulePath) as { startServer: (options: { port: number; dataDir: string }) => Promise<StartedApi> };
  const dataDir = path.join(app.getPath("userData"), "data");
  apiInstance = await apiModule.startServer({ port: 0, dataDir });
  apiBaseUrl = apiInstance.url;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: "#f4f7fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (!app.isPackaged && devServerUrl) {
    await mainWindow.loadURL(`${devServerUrl}?apiBase=${encodeURIComponent(apiBaseUrl)}`);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "apps", "frontend", "dist", "index.html"), {
      query: { apiBase: apiBaseUrl },
    });
  }
}

ipcMain.handle("presucontrol:get-api-base-url", () => apiBaseUrl);
ipcMain.handle("presucontrol:show-error", async (_event, title: string, message: string) => {
  await dialog.showMessageBox({ type: "error", title, message });
});

app.whenReady().then(async () => {
  try {
    await startPackagedApi();
    await createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await dialog.showMessageBox({ type: "error", title: "No se pudo iniciar PresuControl", message });
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (apiInstance) void apiInstance.close();
});
