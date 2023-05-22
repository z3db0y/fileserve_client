const k = {
    10: 12,
    9: 76,
    8: 2,
    7: 17,
    6: 84,
    5: 63,
    4: 25,
    3: 16,
    2: 9,
    1: 32
}

function encode(txt) {
    let ks = Object.keys(k).sort((a, b) => b - a);
    let enc = '';
    for(let i = 0; i < txt.length; i++) {
        for(let j = 0; j < ks.length; j++) {
            if(i % j == 0) {
                enc += String.fromCharCode(txt.charCodeAt(i) + k[j]);
                break;
            }
        }
        if(enc.length != i + 1) enc += txt.charCodeAt(i);
    }
    return enc;
}

function decode(txt) {
    let ks = Object.keys(k).sort((a, b) => b - a);
    let dec = '';
    for(let i = 0; i < txt.length; i++) {
        for(let j = 0; j < ks.length; j++) {
            if(i % j == 0) {
                dec += String.fromCharCode(txt.charCodeAt(i) - k[j]);
                break;
            }
        }
        if(dec.length != i + 1) dec += txt.charCodeAt(i);
    }
    return dec;
}

window.encode = encode;
window.decode = decode;