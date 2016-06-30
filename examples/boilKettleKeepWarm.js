var iKettle = require('../index').iKettle;

var kettleIp = '192.168.1.104'; // Change this to the ip of your kettle

var keepWarm = true; // Values can be: true, false, 5, 10, 20 (for mins to keep warm)

var kettle = new iKettle(kettleIp);
kettle.connect().then(function() {
  return kettle.getStatus();
}).then(function(status) {
  console.log(status);
  kettle.boil100c(keepWarm).then(function() {
    console.log('Now Boiling the Kettle at 100 degrees');
  });
});
