const pako = require('pako');
const { EventEmitter } = require('events');
const WS = require('isomorphic-ws');

const Signer = require('./signer');

class WsApi extends EventEmitter {
  constructor(apiKey, apiSecret, passphrase) {
    super();

    const socket = new WS('wss://real.okex.com:10442/ws/v3');
    socket.binaryType = "arraybuffer";

    const processMessage = message => {
      if (message.data) {
        message = message.data;
      }
      message = pako.inflate(message, { raw: true, to: 'string' });
      // console.log(message);
      if (message === 'pong') return ;

      const data = JSON.parse(message);
      // console.log(data);
      if (data.event) {
        this.emit(data.channel || data.event, data);
      } else if (data.table) {
        this.emit(data.table, data.data);
      }
    };

    if (socket.on) socket.on('message', processMessage);
    else socket.onmessage = processMessage;

    Object.assign(this, {
      signer: new Signer(apiSecret),
      apiKey,
      passphrase,
      socket,
      _listened: new Set()
    });
  }

  subscribe(channel) {
    this.socket.send(JSON.stringify({ op: 'subscribe', args: [channel] }));
    return new Promise(resolve => this.once(channel, resolve));
  }

  login() {
    this.socket.send({
      op: 'login',
      args: [
        this.apiKey,
        this.passphrase,
        ...this.http.signer.sign('/users/self/verify')
      ]
    });

    return new Promise(((resolve, reject) => {
      this.once('login', data => {
        if (data.success) resolve(data);
        else reject(data);
      });
    }));
  }
}

module.exports = WsApi;