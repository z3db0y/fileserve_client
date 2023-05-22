if (typeof require === 'undefined') throw new Error('This script must be run with Electron (make sure nodeIntegration is enabled).');

const child_process = require('child_process');
const os = require('os');
const fs = require('fs');

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
    switch (process.platform) {
        case "win32":
            return child_process.execSync("wmic logicaldisk get name").toString().trim().split('\n').slice(1).map(v => v.trim());
        default:
            return '/';
    }
}

let logoutEl = document.getElementById('logout');
let usernameEl = document.getElementById('username');
let statusEl = document.getElementById('status');

let socket;

let username;
let password;

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
                clientType: 'pc'
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
                                    list: getDrives().map(x => {
                                        return {
                                            name: x,
                                            type: 'folder'
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
                                    }),
                                },
                                to: data.from
                            }));
                        }
                    }
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