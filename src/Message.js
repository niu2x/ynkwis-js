const Envelope = require('./Envelope')

class Message {
	static pack(message, oriBuffer = Buffer.from('')) {
		message = JSON.stringify(message);
		message = Envelope.html(
			Buffer.from(message, 'ascii')
		).toString('ascii');
		var buffer = Buffer.alloc(4 + message.length);
		buffer.writeUInt32BE(message.length, 0);
		buffer.write(message, 4);
		return Buffer.concat([oriBuffer, buffer]);
	}

	static unpack(buffer) {
		if(buffer.length >= 4){
			var length = buffer.readUInt32BE(0);
			if(buffer.length >= 4 + length){
				var message = buffer.slice(4, 4+length);
				message = Envelope.unhtml(message).toString('ascii');
				message = JSON.parse(message);
				buffer = buffer.slice(4+length);
				return [message, buffer];
			}
		}
		return [null, buffer];
	}
};

module.exports = Message;