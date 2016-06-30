var iKettle = require('../index').iKettle;

var kettleIp = '192.168.1.104'; // Change this to the ip of your kettle

var kettle = new iKettle(kettleIp);

kettle.on("status", function(status) {
  console.log('Got Status',status);
});

kettle.on("pong", function() {
  console.log('Pong from Kettle received');
});

kettle.on("warm 20 mins", function() {
  console.log('Warming set to 20 mins');
});

kettle.on("warm 10 mins", function() {
  console.log('Warming set to 10 mins');
});

kettle.on("warm 5 mins", function() {
  console.log('Warming set to 5 mins');
});

kettle.on("warming", function() {
  console.log('Warming has started');
});

kettle.on("warming stopped", function() {
  console.log('Warming has stopped');
});

kettle.on("boil 100c", function() {
  console.log('Kettle Temperature Set to 100c');
});

kettle.on("boil 95c", function() {
  console.log('Kettle Temperature Set to 95c');
});

kettle.on("boil 80c", function() {
  console.log('Kettle Temperature Set to 80c');
});

kettle.on("boil 65c", function() {
  console.log('Kettle Temperature Set to 65c');
});

kettle.on("temp reached", function() {
  console.log('Temperature Reached');
});

kettle.on("problem", function() {
  console.log('The kettle has a problem (maybe boiled dry?)');
});

kettle.on("removed", function(status) {
  console.log('The kettle was removed from base');
});

kettle.on("turned off", function(status) {
  console.log('The kettle was turned off');
});

kettle.on("turned on", function(status) {
  console.log('The kettle was turned on');
});

process.on('SIGINT', function() {
    if (kettle.isConnected) {
      kettle.disconnect();
      kettle = null;
    }
    process.exit();
});

kettle.connect().then(function() {
  return kettle.getStatus();
}).then(function(status) {
  console.log('Connected to Kettle');
});
