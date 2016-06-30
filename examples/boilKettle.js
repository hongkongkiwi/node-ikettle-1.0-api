var iKettle = require('../index').iKettle;

var kettleIp = '192.168.1.104'; // Change this to the ip of your kettle

var kettle = new iKettle(kettleIp);
kettle.connect().then(function() {
  return kettle.getStatus();
}).then(function(status) {
  console.log(status);
  kettle.boil100c(false).then(function() {
    console.log('Now Boiling the Kettle at 100 degrees');
  });
});
