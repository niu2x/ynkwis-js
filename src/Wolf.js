const net = require('net')
const fs = require('fs')
const crypto = require('crypto')
const Message = require('./Message')

const argv = process.argv.slice(2);
if(argv.length <  4){
	console.log("params too few");
	return;
}
const localHost = argv[0]
const localPort = argv[1]
var remoteHost = argv[2]
var remotePort = argv[3]

class Wolf {
	constructor(localSocket) {
		this.localBuffer = Buffer.from('');
		this.remoteBuffer = Buffer.from('');

		this.methodNum = 0;
		this.command = 0
		this.addrType = 0
		this.ipv4 = null
		this.ipv6 = null
		this.domain = null
		this.domainLength = 0
		this.port = 0

		this.clientRequest = Buffer.from('')

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

		this.process = this.readAuthHeader;
		this.process()
	}

	destroy(){
		this.localSocket.destroy();
	}

	process() {

	}

	readAuthHeader(){
		console.log('readAuthHeader');
		if(this.localBuffer.length >=2 ){
			this.methodNum = this.localBuffer.readUInt8(1);
			this.localBuffer = this.localBuffer.slice(2);
			this.process = this.readAuthMethods;
			this.process()
		}
	}

	readAuthMethods() {
		console.log('readAuthMethods');
		if(this.localBuffer.length >= this.methodNum ){
			this.localBuffer = this.localBuffer.slice(this.methodNum);
			this.writeAuthResponse();
			this.process = this.readTargetInfo1
			this.process()
		}
	}

	writeAuthResponse() {
		console.log('writeAuthResponse');
		var response = Buffer.from([0x05, 0x00]);
		this.localSocket.write(response);
	}

	readTargetInfo1() {
		console.log('readTargetInfo1');
		if(this.localBuffer.length >= 4 ){
			this.command = this.localBuffer.readUInt8(1);
			this.addrType = this.localBuffer.readUInt8(3);

			this.clientRequest = Buffer.concat([
				this.clientRequest, 
				this.localBuffer.slice(0, 4),
			]);

			this.localBuffer = this.localBuffer.slice(4);

			if(this.command != 0x01){
				this.destroy();
				return;
			}

			this.process = this.readTargetInfo2;
			this.process()
		}
	}

	readTargetInfo2() {
		console.log('readTargetInfo2');
		if(this.addrType == 1) {
			if(this.localBuffer.length >= 4 ){
				this.ipv4 = this.localBuffer.slice(0, 4);
				this.ipv4 = this.ipv4.readUInt8(0).toString()
					+ "." + this.ipv4.readUInt8(1).toString()
					+ "." + this.ipv4.readUInt8(2).toString()
					+ "." + this.ipv4.readUInt8(3).toString();

				this.clientRequest = Buffer.concat([
					this.clientRequest, 
					this.localBuffer.slice(0, 4),
				]);
				this.localBuffer = this.localBuffer.slice(4);
				this.process = this.readTargetInfo3;
				this.process()
			}
		}
		if(this.addrType == 3) {
			if(this.localBuffer.length >= 1 ){
				this.domainLength = this.localBuffer.readUInt8(0);
				if(this.localBuffer.length >= 1 + this.domainLength) {
					this.domain = this.localBuffer.slice(1, 1+this.domainLength).toString();
					this.clientRequest = Buffer.concat([
						this.clientRequest, 
						this.localBuffer.slice(0, 1+this.domainLength),
					]);
					this.localBuffer = this.localBuffer.slice(1+this.domainLength);
					this.process = this.readTargetInfo3;
					this.process()
				}

			}
			
		}
		if(this.addrType == 4) {
			this.destroy();
		}
	}

	readTargetInfo3() {
		console.log('readTargetInfo3');
		if(this.localBuffer.length >= 2 ){
			this.port = this.localBuffer.readUInt16BE(0);
			this.clientRequest = Buffer.concat([
				this.clientRequest, 
				this.localBuffer.slice(0, 2),
			]);
			this.localBuffer = this.localBuffer.slice(2);
			this.process = this.doNothing;
			this.process()
			this.connectToRemote()
		}
	}

	readData() {
		console.log('readData');
		if(this.localBuffer.length > 0 ){
			var clientData = this.localBuffer;
			this.localBuffer = Buffer.from('');
			this.remoteSocket.write(Message.pack({
				'action' : 'data',
				'data' : clientData.toString('base64'),
			}));

			// console.log("write to remote: ", clientData.toString('ascii'));
		}


		var message
		[message, this.remoteBuffer] = Message.unpack(this.remoteBuffer);
		if(message != null && message.action == 'data'){
			this.localSocket.write(Buffer.from(message.data, 'base64'));
			// console.log("write to local: ", message.data);
		}
	}

	connectToRemote() {
		console.log('connectToRemote');
		this.remoteSocket = net.connect(remotePort, remoteHost);
		this.remoteSocket.on('connect', () => {
			this.writeTargetToRemote()
		});

		this.remoteSocket.on('data', (data)=>{
			this.remoteBuffer = Buffer.concat([
				this.remoteBuffer,
				data,
			]);
			this.process();
		});
		this.remoteSocket.on('close', ()=> this.destroy());
		this.remoteSocket.on('error', ()=> {});
	}

	writeTargetToRemote() {
		console.log('writeTargetToRemote');
		var m = {}
		if(this.addrType == 1){
			m.host = this.ipv4;
		}
		else{
			m.host = this.domain;
		}
		m.port = this.port;
		m.action = 'target';
		m = Message.pack(m);

		this.remoteSocket.write(m)
		this.process = this.readRemoteReply;
	}

	readRemoteReply() {
		console.log('readRemoteReply');
		var message
		[message, this.remoteBuffer] = Message.unpack(this.remoteBuffer);
		if(message != null && message.action == 'confirm') {
			this.process = this.writeClientResponse;
			this.process()
		}
	}

	doNothing () {}

	writeClientResponse() {
		this.clientRequest.writeUInt8(0, 1);
		this.localSocket.write(this.clientRequest);
		this.process = this.readData;
		this.process()
	}

	pack(message) {
		message = JSON.stringify(message);
		var buffer = Buffer.alloc(4 + message.length);
		buffer.writeUInt32BE(message.length, 0);
		buffer.write(message, 4);
		return buffer;
	}

	unpack(buffer) {
		var length = buffer.readUInt32BE(0);
		var message = buffer.slice(4, 4+length).toString('ascii');
		buffer = buffer.slice(4+length);
	}
};


var server = net.createServer((socket)=>{
	new Wolf(socket);
})

server.listen(localPort, localHost);
