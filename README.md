# ynkwis-js
another socks5 tunnel.

# Usage

### 1. provide your crypto key
create a file *src/config.js* with content: 
````
const myIV = '1234567890123456'; // 16 bytes
const myKey = '00111111111122222222223333333333'; // 32 bytes
module.exports = [myIV, myKey];
````

### 2. startup server 
````setsid node ./Tiger.js 0.0.0.0 8889 > /dev/null````

### 3. startup client
````node Wolf.js 127.0.0.1 8081 XX.XX.XX.XX 8889 > /dev/null````

### 4. setup browser's proxy 
````socks5 127.0.0.1 8081````
