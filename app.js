const { app, BrowserWindow, Notification, Tray, Menu, powerSaveBlocker, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let wishToQuit = false;

app.whenReady().then(() => {
    if(!app.requestSingleInstanceLock()) app.quit();
    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            if (!win.isVisible()) win.show();
            win.focus();
        }
    });

    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'FileServe Client',
        icon: path.join(__dirname, 'src/assets/icon.png'),
        show: false
    });

    let hideMenu = Menu.buildFromTemplate([
        {
            label: 'Hide App',
            click: () => {
                win.hide();
                tray.setContextMenu(showMenu);
            }
        },
        {
            label: 'Quit',
            click: () => {
                wishToQuit = true;
                win.close();
            }
        }
    ]);

    let showMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                win.show();
                tray.setContextMenu(hideMenu);
            }
        },
        {
            label: 'Quit',
            click: () => {
                wishToQuit = true;
                app.quit();
            }
        }
    ]);

    const tray = new Tray(path.join(__dirname, 'src/assets/icon.png'));
    tray.setToolTip('FileServe');
    tray.setContextMenu(hideMenu);

    win.setMenu(null);
    if(!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' });
    win.once('ready-to-show', () => {
        win.show();
    });
    win.loadFile('src/index.html');

    win.on('close', ev => {
        if(wishToQuit) return;
        ev.preventDefault();
        win.hide();
        tray.setContextMenu(showMenu);

        if (process.platform === 'darwin') {
            app.dock.hide();
        }

        new Notification({
            title: 'FileServe',
            body: 'The app is still running in the background'
        }).show();
        return false;
    });

    powerSaveBlocker.start('prevent-app-suspension');

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        let urlObj = new URL(url);
        if (urlObj.protocol !== 'file:') {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    await new Promise(resolve => {
        autoUpdater.on('update-downloaded', () => {
            autoUpdater.quitAndInstall(true);
        });
        autoUpdater.on('update-not-available', () => resolve());
        autoUpdater.on('error', () => resolve());
        autoUpdater.checkForUpdates();
    });
});