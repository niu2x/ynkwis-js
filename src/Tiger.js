const net = require('net')
const fs = require('fs')
const crypto = require('crypto')
const Message = require('./Message')

const argv = process.argv.slice(2);
if(argv.length <  2){
	console.log("params too few");
	return;
}
const localHost = argv[0]
const localPort = argv[1]

class Tiger {
	constructor(localSocket) {
		this.localBuffer = Buffer.from('');
		this.remoteBuffer = Buffer.from('');

		this.localSocket = localSocket;
		this.localSocket.on('close', ()=> this.destroy());
		this.localSocket.on('error', ()=> {});
		this.localSocket.on('data', (data)=>{
			this.localBuffer = Buffer.concat([
				this.localBuffer,
				data,
			]);
			this.process();
		});

		this.process = this.readTargetInfo;
		this.process()
	}

	destroy(){
		this.localSocket.destroy();
		if(this.remoteSocket != null)
			this.remoteSocket.destroy();
	}

	process() {}

	doNothing() {}

	readTargetInfo() {
		console.log('readTargetInfo');
		var message
		[message, this.localBuffer] = Message.unpack(this.localBuffer);
		if(message != null && message.action == 'target'){
			this.targetHost = message.host;
			this.targetPort = message.port;
			this.process = this.doNothing;
			this.connectToRemote()
		}

		if(this.localBuffer.length > 0 && message == null){
			const html = `HTTP/1.1 200 OK
Server: nginx/1.19.10
Date: Sun, 16 May 2021 15:21:53 GMT
Content-Type: text/html
Content-Length: 210
Last-Modified: Sat, 15 May 2021 18:04:40 GMT
Connection: keep-alive
ETag: "60a00d38-d2"
Accept-Ranges: bytes

<a href=/video2/480P_600K_232069222.mp4> 480P_600K_232069222.mp4 </a>
<a href=/video2/480P_600K_237840311.mp4> 480P_600K_237840311.mp4 </a>
<a href=/video2/480P_600K_328569982.mp4> 480P_600K_328569982.mp4 </a>`

			this.localSocket.write(html)
		}
	}

	connectToRemote() {
		console.log('connectToRemote');
		this.remoteSocket = net.connect(this.targetPort, this.targetHost)
		this.remoteSocket.on('connect', ()=>{
			this.writeTargetReply()
		});
		this.remoteSocket.on('close', ()=> this.destroy());
		this.remoteSocket.on('error', ()=> {});
		this.remoteSocket.on('data', (data)=>{
			this.remoteBuffer = Buffer.concat([
				this.remoteBuffer,
				data,
			]);
			this.process();
		});
	}

	writeTargetReply() {
		console.log('writeTargetReply');
		this.localSocket.write(Message.pack({
			'action' : 'confirm',
		}))
		this.process = this.readData;
		this.process()
	}

	readData() {
		console.log('readData');
		var message
		[message, this.localBuffer] = Message.unpack(this.localBuffer);
		while(message != null){
			if(message.action == 'data'){
				this.remoteSocket.write(Buffer.from(message.data, 'base64'));
				// console.log('write to remote:', message.data);
			}
			[message, this.localBuffer] = Message.unpack(this.localBuffer);
		}
		
		if(this.remoteBuffer.length > 0){
			this.localSocket.write(Message.pack({
				'action': 'data',
				'data' : this.remoteBuffer.toString('base64'),
			}))
			// console.log('write to local:', this.remoteBuffer.toString('ascii'));
			this.remoteBuffer = Buffer.from('');
		}
	}

};


var server = net.createServer((socket)=>{
	new Tiger(socket);
})

server.listen(localPort, localHost);
