/* jshint node: true */
'use strict';

var fs        = require('fs');
var path      = require('path');
var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);
var Consul    = require('consul');

var Promise   = require('ember-cli/lib/ext/promise');

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
        allowOverwrite: false,
        distDir: function(context) {
          return context.distDir || 'tmp/deploy-dist';
        },
        keyPrefix: function(context){
          return context.project.name() + '/revisions';
        },
        activationSuffix: 'current',
        revisionKey: function(context) {
          return '123';
        },
        consulClient: function() {
          var host   = this.readConfig('host');
          var port   = this.readConfig('port');
          var secure = this.readConfig('secure');

          return Consul({
            host: host,
            port: port,
            secure: secure,
            promisify: true
          });
        }
      },

      upload: function() {
        var allowOverwrite = this.readConfig('allowOverwrite');
        var revisionKey    = this.readConfig('revisionKey');
        var keyPrefix      = this.readConfig('keyPrefix');
        var key            = keyPrefix + '/' + revisionKey;

        var distDir     = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath    = path.join(distDir, filePattern);

        return this._determineIfShouldUpload(key, allowOverwrite)
          .then(this._readFileContents.bind(this, filePath))
          .then(this._upload.bind(this, key));
      },

      _determineIfShouldUpload: function(key, shouldOverwrite) {
        var consul = this.readConfig('consulClient');

        return consul.kv.keys(key)
          .then(function(result) {
            if (result.indexOf(key) === -1 || shouldOverwrite) {
              return Promise.resolve();
            }

            return Promise.reject('Revision already exists');
          }, function() {
            return Promise.resolve(); // revision doesn't already exist
          });
      },

      _readFileContents: function(path) {
        return readFile(path)
          .then(function(buffer) {
            return Promise.resolve(buffer.toString());
          });
      },

      _upload: function(key, data) {
        var consul = this.readConfig('consulClient');

        return consul.kv.set(key, data);
      }
    });

    return new Plugin();
  }
};
