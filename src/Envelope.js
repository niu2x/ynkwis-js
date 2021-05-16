const crypto = require('crypto')

const htmlHeader = `POST /login.php?
Host: www.test.com
Content-Length: 46
Content-Type: html/text

<html><body>Nginx, Hello world.</body></html>
POST /login.php?
Host: www.test.com
Content-Length: 46
Content-Type: html/text

<html><body>Nginx, Hello world.</body></html>`

const htmlFoot = `
I Love My Country, Do you know my name? i am a lonely sole, swim anywhere.
`

const algorithm = 'aes-256-ctr';

const [myIV, myKey] = require('./config')

function encrypt(buffer){
    var iv = Buffer.from(myIV, 'ascii')
    var cipher = crypto.createCipheriv(algorithm, myKey, iv)
    var crypted = Buffer.concat([cipher.update(buffer),cipher.final()]);
    return crypted;
}
 
function decrypt(buffer){
    var iv = Buffer.from(myIV, 'ascii')
    var decipher = crypto.createDecipheriv(algorithm, myKey, iv)
    var dec = Buffer.concat([decipher.update(buffer) , decipher.final()]);
    return dec;
}


class Envelope {
    static html(buffer) {
        return Buffer.concat([
            Buffer.from(htmlHeader, 'ascii'),
            encrypt(buffer),
            Buffer.from(htmlFoot, 'ascii'),
        ]);
    }

    static unhtml(buffer) {
        buffer = buffer.slice(htmlHeader.length, buffer.length-htmlFoot.length);
        buffer = decrypt(buffer);
        return buffer
    }
};

module.exports = Envelope;