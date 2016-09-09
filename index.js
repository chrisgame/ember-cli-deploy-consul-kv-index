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
        namespace: function(context) {
          return context.project.name();
        },
        keyPrefix: function(context){
          return this.readConfig('namespace') + '/revisions';
        },
        activationSuffix: 'current',
        revisionKey: function(context) {
          return context.commandOptions.revision || '666';
        },
        maxEntries: 5,
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
        var allowOverwrite     = this.readConfig('allowOverwrite');
        var maxEntries         = this.readConfig('maxEntries');
        var revisionIdentifier = this.readConfig('revisionKey');
        var namespace          = this.readConfig('namespace');
        var keyPrefix          = this.readConfig('keyPrefix');
        var key                = keyPrefix + '/' + revisionIdentifier;

        var distDir     = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath    = path.join(distDir, filePattern);

        this.log('Uploading `' + filePath + '`', { verbose: true });

        return this._determineIfShouldUpload(key, allowOverwrite)
          .then(this._readFileContents.bind(this, filePath))
          .then(this._upload.bind(this, key))
          .then(this._updateRecentRevisions.bind(this, namespace, revisionIdentifier))
          .then(this._trimRecentRevisions.bind(this, namespace, maxEntries))
          .then(this._uploadSuccess.bind(this, key));
      },

      activate: function() {
        var namespace          = this.readConfig('namespace');
        var revisionIdentifier = this.readConfig('revisionKey');
        var keyPrefix          = this.readConfig('keyPrefix');
        var key                = keyPrefix + '/' + revisionIdentifier;

        this.log('Activating revision `' + key + '`', { verbose: true });

        return this._retrieveRecentRevisions(namespace)
          .then(this._validateRevisionKey.bind(this, revisionIdentifier))
          .then(this._activateRevision.bind(this, namespace, revisionIdentifier))
          .then(this._activationSuccess.bind(this, revisionIdentifier));
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
      },

      _updateRecentRevisions: function(namespace, revisionIdentifier) {
        var consul = this.readConfig('consulClient');
        let key    = namespace + '/recent-revisions';

        return consul.kv.get(key)
          .then(function(result) {
            if (!result) {
              return consul.kv.set(key, revisionIdentifier);
            } else {
              let identifiers = result['Value'].split(',');

              if (identifiers.indexOf(revisionIdentifier) === -1) {
                identifiers.unshift(revisionIdentifier);

                return consul.kv.set(key, identifiers.join(','));
              }
            }

            return Promise.resolve();
          }, function() {
            return Promise.reject('Error occurred updating recent revisions');
          });
      },

      _trimRecentRevisions: function(namespace, maxEntries) {
        var consul = this.readConfig('consulClient');
        let key    = namespace + '/recent-revisions';

        return consul.kv.get(key)
          .then(function(result) {
            let identifiers = result['Value'].split(',');
            let remaining = identifiers.splice(0, maxEntries);

            if (identifiers.length) {
              return consul.kv.set(key, remaining.join(','))
                .then(function() {
                  if (identifiers.length > 0) {
                    return Promise.all(identifiers.map(function(idenfitier) {
                      let key = namespace + '/revisions/' + idenfitier;
                      return consul.kv.del({ key: key, recurse: true });
                    }, []));
                  } else {
                    return Promise.resolve();
                  }
                });
            } else {
              return Promise.resolve();
            }
          });
      },

      _uploadSuccess: function(key) {
        this.log('Uploaded with key `' + key + '`', { verbose: true });
        return Promise.resolve();
      },

      _retrieveRecentRevisions: function(namespace) {
        var consul = this.readConfig('consulClient');
        var key = namespace + '/recent-revisions';

        return consul.kv.get(key)
          .then(function(result) {
            if (result) {
              let identifiers = result['Value'].split(',');

              if (identifiers.length) {
                return identifiers;
              } else {
                return Promise.reject('No recent revisions found');
              }
            } else {
              return Promise.reject('No recent revisions found');
            }
          });
      },

      _validateRevisionKey: function(revisionKey, recentRevisions) {
        if (recentRevisions.indexOf(revisionKey) > -1) {
          return Promise.resolve();
        } else {
          return Promise.reject('Unknown revision key');
        }
      },

      _activateRevision: function(namespace, revisionKey) {
        var consul = this.readConfig('consulClient');
        var key    = namespace + '/active-revision';

        return consul.kv.set(key, revisionKey);
      },

      _activationSuccess: function(revisionKey) {
        this.log('✔ Activated revision `' + revisionKey + '`', { verbose: true });

        return Promise.resolve();
      }
    });

    return new Plugin();
  }
};
