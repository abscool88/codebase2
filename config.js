var HtmlReporter = require('protractor-beautiful-reporter');


exports.config = {
 seleniumAddress: 'http://localhost:4444/wd/hub',
  specs: ['specs.js'],

  
onPrepare: function() {
    jasmine.getEnv().addReporter(new HtmlReporter({
       baseDirectory: 'Reports/screenshot'
    }).getJasmine2Reporter());
}
};