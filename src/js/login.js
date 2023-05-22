let usernameEl = document.getElementById('username');
let passwordEL = document.getElementById('password');
let submitEl = document.getElementById('submit');
let rememberEl = document.getElementById('remember');
let errorEl = document.getElementById('error');

rememberEl.onclick = () => {
    rememberEl.checked = !rememberEl.checked;
    rememberEl[(rememberEl.checked ? 'setAttribute' : 'removeAttribute')]('checked', '');
};

function login() {
    let username = usernameEl.value;
    let password = passwordEL.value;
    if(!username || !password) return errorEl.textContent = 'Fields cannot be blank.';
    errorEl.textContent = 'Please wait...';
    fetch('https://fileserve.z3db0y.com/api/login', {
        method: 'POST',
        body: JSON.stringify({
            username, password
        })
    }).then(r => r.json()).catch(_ => {}).then(r => {
        if(r.ok) {
            errorEl.textContent = '';
            localStorage['fileServe_user'] = encodeURIComponent(username);
            localStorage['fileServe_pass'] = encodeURIComponent(encode(password));
            localStorage['fileServe_remember'] = rememberEl.checked;
            location.href = 'dash.html';
        } else {
            console.log(r);
            errorEl.textContent = 'Invalid username or password.';
        }
    }).catch(_ => errorEl.textContent = 'An unknown error occured.');
}

let searchParams = new URLSearchParams(location.search);
if(searchParams.has('error')) errorEl.textContent = searchParams.get('error');
submitEl.onclick = login;

if(localStorage['fileServe_user'] && localStorage['fileServe_pass']) {
    if(localStorage['fileServe_remember'] === 'true') location.href = 'dash.html';
    else {
        delete localStorage['fileServe_user'];
        delete localStorage['fileServe_pass'];
    }
}