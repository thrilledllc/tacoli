var path               = require('path');
var fs                 = require('fs');
var util               = require('util');
var mkdirp             = require('mkdirp');
var clone              = require('clone');
var RSVP               = require('rsvp');
var helpers            = require('broccoli-kitchen-sink-helpers');
var BroccoliHandlebars = require('broccoli-handlebars');
var idFromData         = require('./id-from-data');

var Promise    = RSVP.Promise;

var SiteHandlebars = function (inputTree, files, options) {
  if (!(this instanceof SiteHandlebars)) {
    return new SiteHandlebars(inputTree, files, options);
  }

  BroccoliHandlebars.apply(this, arguments);
};

SiteHandlebars.prototype = Object.create(BroccoliHandlebars.prototype);
SiteHandlebars.prototype.constructor = BroccoliHandlebars;

SiteHandlebars.prototype.description = 'tacoli-handlebars';

SiteHandlebars.prototype.getTemplate = function (sourceFilepath) {
  var str = fs.readFileSync(sourceFilepath).toString();
  return this.handlebars.compile(str);
};

SiteHandlebars.prototype.writeTemplate = function (filepath, template, data) {
  mkdirp.sync(path.dirname(filepath));
  fs.writeFileSync(filepath, template(data));
};

SiteHandlebars.prototype.write = function (readTree, destDir) {
  var self = this;
  this.loadPartials();
  this.loadHelpers();
  return readTree(this.inputTree).then(function (sourceDir) {
    var targetFiles = helpers.multiGlob(self.files, {cwd: sourceDir});
    return RSVP.all(targetFiles.map(function (targetFile) {
      var sourceFilepath = path.join(sourceDir, targetFile);

      function write (context) {
        var destFile = targetFile.replace(/.(hbs|handlebars)$/, '');
        var destFilepath = path.join(destDir, destFile);
        var dirname = path.dirname(destFilepath);
        var template = self.getTemplate(sourceFilepath);
        
        if (util.isArray(context.page)) {
          context.page.forEach(function (pageContext) {
            var json = clone(context);
            json.page = pageContext;
            var dynamicFilepath = path.join(
              path.dirname(dirname),
              idFromData(pageContext)
            );
            self.writeTemplate(dynamicFilepath, template, json);
          });
        } else {
          var dynamicFilepath = null;
          var page = context.page;
          var contextFilename = null;
          if (page) {
            contextFilename = page.filename;
          }
          if (contextFilename) {
            dynamicFilepath = path.join(path.dirname(destFilepath), contextFilename);
          } else {
            dynamicFilepath = destFilepath + '.html';
          }
          self.writeTemplate(dynamicFilepath, template, context);
        }
      }

      if ('function' !== typeof self.context) write(self.context);
      return Promise.resolve(self.context(targetFile)).then(write);
    }));
  });
};

module.exports = SiteHandlebars;
