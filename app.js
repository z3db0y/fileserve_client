const { app, BrowserWindow, Notification, Tray, Menu, powerSaveBlocker, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

app.whenReady().then(() => {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'src/assets/icon.png'),
        show: false
    });

    win.setMenu(null);
    win.webContents.openDevTools({ mode: 'detach' });
    win.once('ready-to-show', () => {
        win.show();
    });
    win.loadFile('src/index.html');

    win.on('close', ev => {
        ev.preventDefault();
        win.hide();

        if (process.platform === 'darwin') {
            app.dock.hide();
        }

        new Notification({
            title: 'FileServe',
            body: 'The app is still running in the background'
        }).show();

        const tray = new Tray(path.join(__dirname, 'src/assets/icon.png'));
        tray.setToolTip('FileServe');
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    win.show();
                }
            },
            {
                label: 'Quit',
                click: () => {
                    win.destroy();
                }
            }
        ]));
        return false;
    });

    powerSaveBlocker.start('prevent-app-suspension');

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        let urlObj = new URL(url);
        if(urlObj.protocol !== 'file:') {
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

app.on('before-quit', event => {
    event.preventDefault();
    autoUpdater.on('update-downloaded', () => {
        autoUpdater.quitAndInstall(true);
    });
    autoUpdater.on('update-not-available', () => app.exit());
    autoUpdater.on('error', () => app.exit());
    autoUpdater.checkForUpdates();
});