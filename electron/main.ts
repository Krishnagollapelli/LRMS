import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function startBackendServer() {
  if (isDev) {
    console.log('Running in Development mode. Express backend managed by concurrent CLI.');
    return;
  }

  // Path to compiled Express.js server inside production build structure
  const serverPath = path.join(app.getAppPath(), '../server/dist/index.js');
  
  console.log(`Starting Express backend server: ${serverPath}`);
  
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env, 
      PORT: '5000', 
      NODE_ENV: 'production', 
      IS_ELECTRON: 'true' 
    }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start Express backend subprocess:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Express server exited with code ${code} and signal ${signal}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Laboratory Report Management System (LRMS)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    // Load Vite dev server URL
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load local client build distribution index.html
    mainWindow.loadFile(path.join(app.getAppPath(), '../client/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackendServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    console.log('Stopping local Express backend server...');
    serverProcess.kill('SIGTERM');
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
