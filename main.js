const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const iconPath = path.join(__dirname, "build", "icon.png");

  const win = new BrowserWindow({
    width: 790,
    height: 720,
    minWidth: 790,
    minHeight: 620,
    backgroundColor: "#16171c",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
