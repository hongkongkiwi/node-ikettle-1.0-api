var Promise = require('bluebird');
var evilscan = require('evilscan');
var iKettle = require('./iKettle');

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
      results.push(new iKettle(data.ip));
    });

    scanner.on('error',function(err) {
      throw new Error(data.toString());
    });

    scanner.on('done',function() {
      console.log('Found',results.length,'iKettles on network');
      //scanner.abort();
      scanner.removeAllListeners();
      scanner = null;
      resolve(results);
    });

    scanner.run();
  });
}

module.exports = iKettleFinder;
