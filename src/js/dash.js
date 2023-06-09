if (typeof require === 'undefined') throw new Error('This script must be run with Electron (make sure nodeIntegration is enabled).');

const child_process = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const mime = require('mime');

function getComputerName() {
    switch (process.platform) {
        case "win32":
            return process.env.COMPUTERNAME;
        case "darwin":
            return child_process.execSync("scutil --get ComputerName").toString().trim();
        case "linux":
            const prettyname = child_process.execSync("hostnamectl --pretty").toString().trim();
            return prettyname === "" ? os.hostname() : prettyname;
        default:
            return os.hostname();
    }
}

function getDrives() {
    return child_process.execSync("wmic logicaldisk get name").toString().trim().split('\n').slice(1).map(v => v.trim());
}

let logoutEl = document.getElementById('logout');
let usernameEl = document.getElementById('username');
let statusEl = document.getElementById('status');

let socket;

let username;
let password;

let currentUploads = {};

if (!localStorage['fileServe_user'] || !localStorage['fileServe_pass']) {
    location.href = 'index.html';
} else {
    username = decodeURIComponent(localStorage['fileServe_user']);
    password = decode(decodeURIComponent(localStorage['fileServe_pass']));

    if (localStorage['fileServe_remember'] !== 'true') {
        delete localStorage['fileServe_user'];
        delete localStorage['fileServe_pass'];
        delete localStorage['fileServe_remember'];
    }

    connect();
}

logoutEl.onclick = () => {
    delete localStorage['fileServe_user'];
    delete localStorage['fileServe_pass'];
    delete localStorage['fileServe_remember'];
    location.href = 'index.html';
};

function connect() {
    usernameEl.textContent = username;

    statusEl.textContent = 'Connecting...';
    statusEl.className = 'connecting';

    socket = new WebSocket('wss://fileserve.z3db0y.com/api/ws');

    socket.onopen = () => {
        console.log('Connected to socket.');
        statusEl.textContent = 'Connected';
        statusEl.className = 'connected';

        socket.send(JSON.stringify({
            type: 'auth',
            data: {
                username, password,
                pcName: getComputerName(),
                clientType: 'pc',
                win: process.platform === 'win32'
            }
        }));
    };

    socket.onmessage = ({ data }) => {
        try {
            data = JSON.parse(data);
            console.log(data);
            switch(data.type) {
                case 'auth':
                    if(!data.data.ok) {
                        location.href = 'index.html?error=Invalid%20username%20or%20password.';
                    }
                    break;
                case 'web2pc':
                    if(data.data.cmd === 'ls') {
                        if(data.data.dir === '') {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'ls',
                                    dir: data.data.dir,
                                    list: process.platform === 'win32' ? getDrives().map(x => {
                                        return {
                                            name: x,
                                            type: 'folder'
                                        }
                                    }) : fs.readdirSync('/', { withFileTypes: true }).map(x => {
                                        return {
                                            name: x.name,
                                            type: x.isDirectory() ? 'folder' : 'file'
                                        }
                                    })
                                },
                                to: data.from
                            }));
                        } else {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'ls',
                                    dir: data.data.dir,
                                    list: fs.readdirSync(data.data.dir, { withFileTypes: true }).map(x => {
                                        return {
                                            name: x.name,
                                            type: x.isDirectory() ? 'folder' : 'file'
                                        }
                                    })
                                },
                                to: data.from
                            }));
                        }
                    } else if(data.data.cmd === 'mkdir') {
                        try {
                            fs.mkdirSync(data.data.dir);
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'mkdir',
                                    dir: data.data.dir,
                                    ok: true
                                },
                                to: data.from
                            }));
                        } catch {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'mkdir',
                                    dir: data.data.dir,
                                    ok: false
                                },
                                to: data.from
                            }));
                        }
                    } else if(data.data.cmd === 'upload') {
                        if(!data.data.uploadId || !data.data.file) return;
                        let uploadId = data.data.uploadId;
                        if(!currentUploads[data.from]) currentUploads[data.from] = {};
                        if(!currentUploads[data.from][uploadId]) {
                            currentUploads[data.from][uploadId] = {
                                file: data.data.file.name,
                                data: data.data.file.chunk
                            };
                            if(!data.data.file.chunk.startsWith('data:')) delete currentUploads[data.from][uploadId].data;
                        } else {
                            if(!data.data.file.chunk) {
                                socket.send(JSON.stringify({
                                    data: {
                                        cmd: 'u_ack',
                                        uploadId,
                                        size: currentUploads[data.from][uploadId].data.length
                                    },
                                    to: data.from
                                }));
                                try {
                                    if(fs.existsSync(path.join(data.data.dir, currentUploads[data.from][uploadId].file))) throw new Error('File already exists.');
                                    fs.writeFileSync(path.join(data.data.dir, currentUploads[data.from][uploadId].file), Buffer.from(currentUploads[data.from][uploadId].data.split(',')[1], 'base64'));
                                    socket.send(JSON.stringify({
                                        data: {
                                            cmd: 'upload',
                                            dir: data.data.dir,
                                            file: {
                                                name: currentUploads[data.from][uploadId].file
                                            },
                                            uploadId,
                                            ok: true
                                        },
                                        to: data.from
                                    }));
                                } catch {
                                    socket.send(JSON.stringify({
                                        data: {
                                            cmd: 'upload',
                                            dir: data.data.dir,
                                            file: {
                                                name: currentUploads[data.from][uploadId].file
                                            },
                                            uploadId,
                                            ok: false
                                        },
                                        to: data.from
                                    }));
                                }
                            } else {
                                currentUploads[data.from][uploadId].data += data.data.file.chunk;
                                socket.send(JSON.stringify({
                                    data: {
                                        cmd: 'u_ack',
                                        uploadId,
                                        size: currentUploads[data.from][uploadId].data.length
                                    },
                                    to: data.from
                                }));
                            }
                        }
                    } else if(data.data.cmd === 'rename') {
                        try {
                            fs.renameSync(path.join(data.data.dir, data.data.file.name), path.join(data.data.dir, data.data.file.newName));
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'rename',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name,
                                        newName: data.data.file.newName
                                    },
                                    ok: true
                                },
                                to: data.from
                            }));
                        } catch {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'rename',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name,
                                        newName: data.data.file.newName
                                    },
                                    ok: false
                                },
                                to: data.from
                            }));
                        }

                    } else if(data.data.cmd === 'del') {
                        try {
                            if(!fs.existsSync(path.join(data.data.dir, data.data.file.name))) throw new Error('File does not exist.');
                            if(fs.lstatSync(path.join(data.data.dir, data.data.file.name)).isDirectory()) {
                                fs.rmdirSync(path.join(data.data.dir, data.data.file.name), { recursive: true });
                            } else {
                                fs.unlinkSync(path.join(data.data.dir, data.data.file.name));
                            }
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'del',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name
                                    },
                                    ok: true
                                },
                                to: data.from
                            }));
                        } catch {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'del',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name
                                    },
                                    ok: false
                                },
                                to: data.from
                            }));
                        }
                    } else if(data.data.cmd === 'download') {
                        try {
                            if(!fs.existsSync(path.join(data.data.dir, data.data.file.name))) throw new Error('File does not exist.');
                            
                            let downloadId = data.data.downloadId;
                            let downloadData;

                            if(fs.lstatSync(path.join(data.data.dir, data.data.file.name)).isDirectory()) {
                                let zipFile = new AdmZip();
                                zipFile.addLocalFolder(path.join(data.data.dir, data.data.file.name));
                                let zipData = zipFile.toBuffer();
                                downloadData = 'data:application/zip;base64,' + zipData.toString('base64');
                            } else {
                                let fileData = fs.readFileSync(path.join(data.data.dir, data.data.file.name));
                                downloadData = 'data:' + mime.getType(path.extname(data.data.file.name).slice(1)) + ';base64,' + fileData.toString('base64');
                            }

                            for(let i = 0; i < downloadData.length; i+= 1024 * 1024) { // 1MB chunk size
                                socket.send(JSON.stringify({
                                    data: {
                                        cmd: 'download',
                                        dir: data.data.dir,
                                        file: {
                                            name: data.data.file.name,
                                            chunk: downloadData.substring(i, i + 1024 * 1024),
                                            size: downloadData.length
                                        },
                                        downloadId
                                    },
                                    to: data.from
                                }));
                            }

                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'download',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name,
                                        size: downloadData.length
                                    },
                                    downloadId
                                },
                                to: data.from
                            }));
                        } catch(e) {
                            socket.send(JSON.stringify({
                                data: {
                                    cmd: 'download',
                                    dir: data.data.dir,
                                    file: {
                                        name: data.data.file.name
                                    },
                                    ok: false
                                },
                                to: data.from
                            }));
                            return;
                        }
                    }
                    break;
                case 'web_disconnect':
                    if(currentUploads[data.from]) delete currentUploads[data.from];
                    break;
            }
        } catch { }
    };

    socket.onclose = () => {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'disconnected';
        setTimeout(connect, 1000);
    };

    socket.onerror = () => { };
}