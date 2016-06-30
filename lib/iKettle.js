var Promise = require('bluebird');
var net = require('net');
var _ = require('underscore');
var BitMask = require('bit-mask');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var debug = require('debug')('ikettle::ikettle');

var iKettle = function(ipAddress, options) {
  EventEmitter.call(this);

  this.options = _.extendOwn({
    port: 2000,
    lineEnding: "\n" // apparently for newer 1.0 versions it uses /r/n
  }, options);

  this.ipAddress = ipAddress;
  this.client = null;
  this.isConnected = false;
  this.status = {
    temp: -1,
    isWarming: false,
    isOn: false,
    hasProblem: false,
    isRemoved: false
  };
}

util.inherits(iKettle, EventEmitter);

iKettle.COMMAND = {
  PING: "HELLOKETTLE",
  GET_STATUS: "get sys status",
  BOIL_100C: "set sys output 0x80",
  BOIL_95C: "set sys output 0x2",
  BOIL_80C: "set sys output 0x4000",
  BOIL_65C: "set sys output 0x200",
  WARM: "set sys output 0x8", // Same as pressing button on kettle
  WARM_5_MINS: "set sys output 0x8005",
  WARM_10_MINS: "set sys output 0x8010",
  WARM_20_MINS: "set sys output 0x8020",
  TURN_ON: "set sys output 0x4",
  TURN_OFF: "set sys output 0x0",
};

iKettle.STATUS = {
  PONG: 'HELLOAPP\r',
  STATUS: 'sys status key=',
  BOIL_100C: "sys status 0x100\r",
  BOIL_95C: "sys status 0x95\r",
  BOIL_80C: "sys status 0x80\r",
  BOIL_65C: "sys status 0x65\r",
  TEMP_REACHED: "sys status 0x3\r", // Reached Temperature
  TURNED_ON: "sys status 0x5\r",
  TURNED_OFF: "sys status 0x0\r",
  WARM_5_MINS: "sys status 0x8005\r",
  WARM_10_MINS: "sys status 0x8010\r",
  WARM_20_MINS: "sys status 0x8020\r",
  WARMING: "sys status 0x11\r",
  WARMING_STOPPED: "sys status 0x10\r",
  PROBLEM: "sys status 0x2\r", // Boil Dry?
  REMOVED: "sys status 0x1\r", // Removed from base
};

iKettle.prototype._handleClose = function(context) {
  var me = context;
  debug('Connection to Kettle closed');
  if (me.client) {
    me.client.removeAllListeners();
  }
  me.client = null;
  me.removeAllListeners();
  me.isConnected = false;
};

iKettle.prototype._handleData = function(data, context) {
  var me = context;
  data = data.toString('ascii');
  if (data.substr(0,iKettle.STATUS.STATUS.length) === iKettle.STATUS.STATUS) {
    var mask = new BitMask(Buffer.from(data.slice(iKettle.STATUS.STATUS.length,data.length-1),'ascii').readUInt8());
    // Bit6	Bit5 Bit4	Bit3 Bit2	Bit1
    // 100C	95C	 80C	65C	 Warm	On
    // 0x20 0x10 0x08 0x04 0x02 0x01

    var isWarming = mask.getBit(2);
    var isOn = mask.getBit(1);
    var temp = -1;

    debug({
      6: mask.getBit(6),
      5: mask.getBit(5),
      4: mask.getBit(4),
      3: mask.getBit(3),
      2: mask.getBit(2),
      1: mask.getBit(1)
    });

    if (mask.getBit(6))
      temp = 100;
    else if (mask.getBit(5))
      temp = 95;
    else if (mask.getBit(4))
      temp = 80;
    else if (mask.getBit(3))
      temp = 65;

    var status = {
      temp: temp,
      isWarming: isWarming,
      isOn: isOn
    };

    debug('Got Status', status)
    me.status = status;
    me.emit('status',status);
  } else if (data === iKettle.STATUS.BOIL_100C) {
    me.status.temp = 100;
    debug('Kettle is set to temperature 100c');
    me.emit('boil 100c');
  } else if (data === iKettle.STATUS.BOIL_95C) {
    me.status.temp = 95;
    debug('Kettle is set to temperature 95c');
    me.emit('boil 95c');
  } else if (data === iKettle.STATUS.BOIL_80C) {
    me.status.temp = 80;
    debug('Kettle is set to temperature 80c');
    me.emit('boil 80c');
  } else if (data === iKettle.STATUS.BOIL_65C) {
    me.status.temp = 65;
    debug('Kettle is set to temperature 65c');
    me.emit('boil 65c');
  } else if (data === iKettle.STATUS.TEMP_REACHED) {
    debug('Kettle has reached desired temperature', me.status.temp);
    me.emit('temp reached');
  } else if (data === iKettle.STATUS.PROBLEM) {
    me.status.hasProblem = true;
    me.status.isOn = false;
    debug('Kettle has a problem, maybe there is no water?');
    me.emit('problem');
  } else if (data === iKettle.STATUS.REMOVED) {
    debug('Kettle has been removed from it\'s base');
    me.status.isRemoved = true;
    me.status.isOn = false;
    me.emit('removed');
  } else if (data === iKettle.STATUS.TURNED_OFF) {
    debug('Kettle has turned off');
    me.status.isOn = false;
    me.emit('turned off');
  } else if (data === iKettle.STATUS.TURNED_ON) {
    debug('Kettle has turned on');
    me.status.isOn = true;
    me.emit('turned on');
  } else if (data === iKettle.STATUS.WARMING) {
    debug('Kettle keeping water warm');
    me.emit('warming');
  } else if (data === iKettle.STATUS.WARMING_STOPPED) {
    debug('Kettle cancelled keeping water warm');
    me.emit('warming stopped');
  } else if (data === iKettle.STATUS.WARM_5_MINS) {
    debug('Kettle is keeping water warm for 5 minutes');
    me.emit('warm 5 mins');
  } else if (data === iKettle.STATUS.WARM_10_MINS) {
    debug('Kettle is keeping water warm for 10 minutes');
    me.emit('warm 10 mins');
  } else if (data === iKettle.STATUS.WARM_20_MINS) {
    debug('Kettle is keeping water warm for 20 minutes');
    me.emit('warm 20 mins');
  } else if (data === iKettle.STATUS.PONG) {
    debug('Kettle is alive');
    me.emit('pong');
  } else {
    console.log('got data', data);
  }
};

iKettle.prototype._sendCommand = function(command) {
  if (!iKettle.COMMAND.hasOwnProperty(command))
    throw new Error('Invalid Command: ' + command);

  var me = this;
  return new Promise(function(resolve, reject) {
    debug('Sending Command', command, iKettle.COMMAND[command]);
    me.client.write(iKettle.COMMAND[command] + me.options.lineEnding);
    resolve();
  });
}

iKettle.prototype._boil = function(temp, keepWarm) {
  var me = this;
  debug('Boiling for ' + temp + ' degrees');

  var boilPromise = new Promise(function(resolve,reject) {
      temp = parseInt(temp);
      if (_.isNaN(temp)) {
        return reject('Invalid Temperature Requested! Must be either 100,95,80 or 65');
      }
      switch (temp) {
        case 100:
          return me._sendCommand('BOIL_100C');
          break;
        case 95:
          return me._sendCommand('BOIL_95C');
          break;
        case 80:
          return me._sendCommand('BOIL_80C');
          break;
        case 65:
          return me._sendCommand('BOIL_65C');
          break;
        default:
          return reject('Invalid Temperature Requested! Must be either 100,95,80 or 65');
      }
    });

  var keepWarmPromise = new Promise(function(resolve,reject) {
    if (_.isNull(keepWarm) || _.isUndefined(keepWarm)) {
      keepWarm = false;
      resolve();
    } else if (!_.isNaN(parseInt(keepWarm))) {
      switch (parseInt(keepWarm)) {
        case 5:
          return me._sendCommand('WARM_5_MINS');
          break;
        case 10:
          return me._sendCommand('WARM_10_MINS');
          break;
        case 20:
          return me._sendCommand('WARM_20_MINS');
          break;
        default:
          return reject('Must set timer to 5,10 or 20 minutes for keeping warm');
      }
    } else if (keepWarm) {
      return me._sendCommand('WARM');
    }
  });

  var turnOnPromise = new Promise(function(resolve,reject) {
    me.turnOn.then(function() {
      me.status.temp = temp;
      resolve(temp);
    });
  });

  return turnOnPromise.then(function() {
    return boilPromise;
  }).then(function() {
    return keepWarmPromise;
  });
}

iKettle.prototype.connect = function() {
  var me = this;
  return new Promise(function(resolve, reject) {
    if (me.isConnected) {
      debug('Already Connected to Kettle');
      return resolve();
    }
    debug('Connecting to Kettle', me.ipAddress);
    me.client = new net.Socket();
    me.client.on('close', function() { me._handleClose(me) });
    me.client.on('data', function(data) { me._handleData(data, me) });
    me.client.connect(me.options.port, me.ipAddress, function() {
      me.isConnected = true;
      debug('Connected to Kettle', me.ipAddress);
      return me.ping();
    });
  });
}

iKettle.prototype.disconnect = function() {
  debug('Disconnect from Kettle', this.ipAddress);
  this.client.destroy();
}

iKettle.prototype.boilWater = function(keepWarm) {
  return this.boil100c(keepWarm);
}

iKettle.prototype.boilBlackTea = function(keepWarm) {
  return this.boil95c(keepWarm);
}

iKettle.prototype.boilGreenTea = function(keepWarm) {
  return this.boil80c(keepWarm);
}

iKettle.prototype.boilWhiteTea = function(keepWarm) {
  return this.boil65c(keepWarm);
}

iKettle.prototype.boil100c = function(keepWarm) {
  return this._boil(100, keepWarm);
}

iKettle.prototype.boil95c = function(keepWarm) {
  return this._boil(95, keepWarm);
}

iKettle.prototype.boil80c = function(keepWarm) {
  return this._boil(80, keepWarm);
}

iKettle.prototype.boil65c = function(keepWarm) {
  return this._boil(65, keepWarm);
}

iKettle.prototype.turnOn = function() {
  return this._command('TURN_ON').then(function() {
    me.status.isOn = true;
  });
}

iKettle.prototype.turnOff = function() {
  return this._command('TURN_OFF').then(function() {
    me.status.isOn = false;
  });
}

iKettle.prototype.ping = function(context) {
  context = context || this;
  return context._sendCommand('PING', context);
}

iKettle.prototype.getStatus = function() {
  var me = this;
  return new Promise(function(resolve, reject) {
    debug('Getting Status for Kettle', me.ipAddress);
    me.once('status', function(status) {
      resolve(status);
    });
    me._sendCommand('GET_STATUS');
  });
}

module.exports = iKettle;
