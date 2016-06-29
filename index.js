var Promise = require('bluebird');
var evilscan = require('evilscan');
var net = require('net');
var _ = require('underscore');
var BitMask = require('bit-mask');

var iKettleFinder = {};

iKettleFinder.discoverKettles = function() {
  return new Promise(function(resolve, reject) {
    var options = {
        target:'192.168.1.0/24',
        port:'2000',
        status:'O', // Timeout, Refused, Open, Unreachable
        banner: false
    };

    var results = [];

    var scanner = new evilscan(options);

    scanner.on('result',function(data) {
      console.log(data.ip)
      results.push(new iKettle(data.ip));
    });

    scanner.on('error',function(err) {
      throw new Error(data.toString());
    });

    scanner.on('done',function() {
      console.log('Found',results.length,'iKettles on network');
      resolve(results);
    });

    scanner.run();
  });
}

var iKettle = function(ipAddress, options) {
  this.options = _.extendOwn({
    port: 2000
  }, options);

  this.ipAddress = ipAddress;
  this.client = new net.Socket();
  this.isConnected = false;

  this.client.on('close', function() {
    console.log('Connection closed');
  });
}

iKettle.COMMAND = {
  'STATUS': "get sys status\n",
  '100C': "set sys output 0x80",
  '95C': "set sys output 0x2",
  '80C': "set sys output 0x4000",
  '65C': "set sys output 0x200",
  'WARM': "set sys output 0x8",
  'WARM5': "set sys output 0x8005",
  'WARM10': "set sys output 0x8010",
  'WARM20': "set sys output 0x8020",
  'ON': "set sys output 0x4",
  'OFF': "set sys output 0x0",
};

iKettle.STATUS = {
  'STATUS': 'sys status key=',
  '100C': "sys status 0x100",
  '95C': "sys status 0x95",
  '80C': "sys status 0x80",
  '65C': "sys status 0x65",
  'WARMING': "sys status 0x11",
  'WARMINGSTOPPED': "sys status 0x10",
  'TURNEDON': "sys status 0x5",
  'TURNEDOFF': "sys status 0x0",
  'WARM5': "sys status 0x8005",
  'WARM10': "sys status 0x8010",
  'WARM20': "sys status 0x8020",
  'TEMPREACHED': "sys status 0x3",
  'PROBLEM': "sys status 0x2",
  'REMOVED': "sys status 0x1",
};

iKettle.prototype.connect = function() {
  var me = this;
  return new Promise(function(resolve, reject) {
    me.client.connect(me.options.port, me.ipAddress, function() {
      resolve();
    });
  });
}

iKettle.prototype.disconnect = function() {
  this.client.destroy();
}

iKettle.prototype.getStatus = function() {
  var me = this;
  return new Promise(function(resolve, reject) {
    me.client.once('data', function(data) {
      var data = data.toString('ascii');
      if (data.substr(0,iKettle.STATUS.STATUS.length) === iKettle.STATUS.STATUS) {
        var status = Buffer.from(data.slice(iKettle.STATUS.STATUS.length,data.length-1),'ascii').readUInt8();
        console.log(status)
          var mask = new BitMask(status);
          // Bit6	Bit5 Bit4	Bit3 Bit2	Bit1
          // 100C	95C	 80C	65C	 Warm	On
          // 0x20 0x10 0x08 0x04 0x02 0x01

          var is100C = mask.getBit(6);
          var is95C = mask.getBit(5);
          var is80C = mask.getBit(4);
          var is65C = mask.getBit(3);
          var isWarming = mask.getBit(2);
          var isOn = mask.getBit(1);

          console.log({
            is100C: is100C,
            is95C: is95C,
            is80C: is80C,
            is65C: is65C,
            isWarming: isWarming,
            isOn: isOn
          });
      }
    });
    me.client.write(iKettle.COMMAND.STATUS);
  });
}

var kettle = new iKettle('192.168.1.104');
kettle.connect().then(function() {
  return kettle.getStatus();
}).then(function(status) {
  console.log(status);
});

// iKettleFinder.discoverKettles().then(function(kettles) {
//   var kettle = kettles[0];
//   kettle.connect().then(function() {
//     return kettle.getStatus();
//   }).then(function(status) {
//     console.log(status);
//   });
// });
