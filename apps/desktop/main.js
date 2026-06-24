const { app, BrowserWindow, ipcMain, shell } = require('electron');

const path = require('path');
const fs = require('fs');
let mainWindow;

function createWindow() {
    console.log("Creating BrowserWindow");
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'default',
        backgroundColor: '#1a1a1a',
        show: true
    });
    console.log("Loading URL");
    // Load the app
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        console.log("Dev URL loaded");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

}


function getAppFolder() {
    const userDataPath = app.getPath('userData');
    const appFolder = path.join(userDataPath, 'files');

    if (!fs.existsSync(appFolder)) {
        fs.mkdirSync(appFolder, { recursive: true });
    }

    return appFolder;
}
// App lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers


ipcMain.handle("get-app-folder", () => {
    return getAppFolder();
});

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});
ipcMain.handle('app:getPlatform', () => {
    return process.platform;
});


ipcMain.handle("save-file", async (event, buffer, fileName) => {
    const folder = getAppFolder();

    const filePath = path.join(folder, fileName);

    fs.writeFileSync(filePath, Buffer.from(buffer));

    return filePath; // return saved path
});
ipcMain.handle("open-file", async (event, filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error("File not found");
    }

    await shell.openPath(filePath);
    return true;
});
