const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { initLicense, isLocked } = require("./license.js");
const { initUpdater } = require("./updater.js");

// Keeps the taskbar grouping / hover name as "Mondiro Toolbox" instead of "Electron".
// Must match build.appId in package.json.
if (process.platform === "win32") {
  app.setAppUserModelId("com.mondiro.toolbox");
}
app.setName("Mondiro Toolbox");

let mainWindow;

// Remembers the window size/position between launches.
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");
const MIN_WIDTH = 900;
const MIN_HEIGHT = 640;

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    return { width: Math.max(s.width || 1040, MIN_WIDTH), height: Math.max(s.height || 740, MIN_HEIGHT), x: s.x, y: s.y };
  } catch (e) {
    return { width: 1040, height: 740 };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(mainWindow.getNormalBounds())); } catch (e) { /* not critical */ }
}

function createWindow() {
  // Windows: dung file .ico nhieu co de taskbar/thanh tieu de tu chon ban 16-40px (ban toi gian),
  // thay vi thu nho anh 512px (ban day du nhieu cham nho).
  const iconPath = path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png");
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Mondiro Toolbox",
    backgroundColor: "#1F2126",
    // An thanh tieu de Windows: header Mondiro la thanh tieu de, 3 nut cua so nam de goc phai cung mau header
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#1F2126", symbolColor: "#FFFFFF", height: 58 },
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  let saveTimer = null;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveWindowState, 300); };
  mainWindow.on("resize", scheduleSave);
  mainWindow.on("move", scheduleSave);
  mainWindow.on("close", saveWindowState);
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
