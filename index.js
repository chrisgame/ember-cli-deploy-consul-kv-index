/* jshint node: true */
'use strict';

var fs        = require('fs');
var path      = require('path');
var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);
var Consul    = require('consul');

var BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-consul-kv-index',

  createDeployPlugin: function(options) {
    var Plugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        secure: true,
        host: 'localhost',
        port: 8500,
        filePattern: 'index.html',
        distDir: function(context) {
          return context.distDir || 'tmp/deploy-dist';
        },
        keyPrefix: function(context){
          return context.project.name() + '/revisions';
        },
        activationSuffix: 'current',
        revisionKey: function(context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        }
      },

      upload: function() {
        var host   = this.readConfig('host');
        var port   = this.readConfig('port');
        var secure = this.readConfig('secure');

        var consul = Consul({
          host: host,
          port: port,
          secure: secure,
          promisify: true
        });

        var revisionKey = this.readConfig('revisionKey');
        var keyPrefix   = this.readConfig('keyPrefix');
        var key         = keyPrefix + '/' + revisionKey;

        var distDir     = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath    = path.join(distDir, filePattern);

        return this._readFileContents(filePath)
          .then(function(data) {
            return consul.kv.set(key, data);
          });
      },

      _readFileContents: function(path) {
        return readFile(path)
          .then(function(buffer) {
            return buffer.toString();
          });
      }

    });

    return new Plugin();
  }
};
