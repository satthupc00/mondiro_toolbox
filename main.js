const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { initLicense, isLocked } = require("./license.js");
const { initUpdater } = require("./updater.js");

ipcMain.on("get-app-version", (e) => { e.returnValue = app.getVersion(); });

// Keeps the taskbar grouping / hover name as "Mondiro Toolbox" instead of "Electron".
// Must match build.appId in package.json.
if (process.platform === "win32") {
  app.setAppUserModelId("com.mondiro.toolbox");
}
app.setName("Mondiro Toolbox");

let mainWindow;

// First launch after a fresh install: show the notes of this version (release-notes.md) once.
// Copies that update later already see the notes in the update dialog, so this only runs when
// the app has never recorded a launch on this machine.
const WELCOME_FILE = path.join(app.getPath("userData"), "welcome.json");

function readReleaseNotes() {
  try {
    const text = fs.readFileSync(path.join(__dirname, "release-notes.md"), "utf-8").replace(/<!--[\s\S]*?-->/g, "");
    return text.split(/\r?\n/).filter((l) => !/^#\s*v?[\d.]+\s*$/.test(l.trim())).join("\n").trim();
  } catch (e) {
    return "";
  }
}

ipcMain.handle("show-welcome", async () => {
  if (fs.existsSync(WELCOME_FILE)) return;
  try { fs.writeFileSync(WELCOME_FILE, JSON.stringify({ firstVersion: app.getVersion() })); } catch (e) { /* not critical */ }
  const notes = readReleaseNotes();
  if (!notes || !mainWindow || mainWindow.isDestroyed()) return;
  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Mondiro Toolbox",
    message: `Mondiro Toolbox v${app.getVersion()}`,
    detail: notes,
    buttons: ["OK"],
    noLink: true,
  });
});

function createWindow() {
  const iconPath = path.join(__dirname, "build", "icon.png");

  mainWindow = new BrowserWindow({
    width: 790,
    height: 720,
    minWidth: 790,
    minHeight: 620,
    title: "Mondiro Toolbox",
    backgroundColor: "#16171c",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  initLicense(() => mainWindow);
  initUpdater(() => mainWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// F12 / Ctrl+Shift+I open DevTools for diagnosing on someone else's machine, but stay closed
// while the app is locked so the lock screen can't simply be deleted.
app.on("browser-window-created", (_e, win) => {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const devtools = input.key === "F12"
      || (input.control && input.shift && input.key.toLowerCase() === "i");
    if (devtools) {
      event.preventDefault();
      if (!isLocked()) win.webContents.toggleDevTools();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
