var iKettleFinder = require('../index').iKettleFinder;

iKettleFinder.discoverKettles().then(function(kettles) {
  if (kettles.length > 0) {
    var kettle = kettles[0];
    kettle.connect().then(function() {
      return kettle.getStatus();
    }).then(function(status) {
      console.log(status);
    });
  }
});
