/* jshint node: true */

var fs        = require('fs');
var path      = require('path');
var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);
var consulLib = require('consul');
var Consul    = require('./lib/consul');

var Promise   = require('ember-cli/lib/ext/promise');

var BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-consul-kv-index',

  createDeployPlugin: function(options) {
    var Plugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        host: 'localhost',
        port: 8500,
        secure: true,
        filePattern: 'index.html',
        distDir: function(context) {
          return context.distDir || 'tmp/deploy-dist';
        },
        revisionKey: function(context) {
          return (context.revisionData && context.revisionData.revisionKey) || 'missing-revision-key';
        },
        namespaceToken: function(context) {
          return (context.project && context.project.name()) || 'missing-namespace';
        },
        recentRevisionsToken: 'recent-revisions',
        activeRevisionToken: 'active-revision',
        revisionKeyToActivate: function(context) {
          return (context.commandOptions && context.commandOptions.revision);
        },
        metadata: function(context) {
          return context.revisionData || {};
        },
        allowOverwrite: true,
        maxRevisions: 10
      },

      setup: function(context) {
        var namespaceToken       = this.readConfig('namespaceToken');
        var recentRevisionsToken = this.readConfig('recentRevisionsToken');
        var activeRevisionToken  = this.readConfig('activeRevisionToken');

        var host    = this.readConfig('host');
        var port    = this.readConfig('port');
        var secure  = this.readConfig('secure');
        var options = {
          host: host,
          port: port,
          secure: secure,
          promisify: true
        };

        var client;

        if (context._consulLib) {
          client = context._consulLib;
        } else {
          client = consulLib(options).kv;
        }

        var consul = new Consul(client, namespaceToken, recentRevisionsToken, activeRevisionToken);

        context._consul = consul;
      },

      upload: function(context) {
        var allowOverwrite = this.readConfig('allowOverwrite');
        var maxRevisions   = this.readConfig('maxRevisions');
        var revisionKey    = this.readConfig('revisionKey');
        var metadata       = this.readConfig('metadata');

        var distDir     = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath    = path.join(distDir, filePattern);

        var consul = context._consul;

        this.log('Uploading `' + filePath + '`', { verbose: true });

        return this._determineIfShouldUpload(consul, revisionKey, allowOverwrite)
          .then(this._readFileContents.bind(this, filePath))
          .then(this._uploadRevision.bind(this, consul, revisionKey))
          .then(this._uploadMetadata.bind(this, consul, revisionKey, metadata))
          .then(this._updateRecentRevisions.bind(this, consul, revisionKey))
          .then(this._trimRecentRevisions.bind(this, consul, maxRevisions))
          .then(this._uploadSuccess.bind(this, revisionKey));
      },

      activate: function(context) {
        var namespace   = this.readConfig('namespaceToken');
        var revisionKey = this.readConfig('revisionKeyToActivate');

        var consul = context._consul;

        this.log('Activating revision `' + revisionKey + '` in namespace `' + namespace + '`', { verbose: true });

        return consul.recentRevisionKeys()
          .then(this._validateRevisionKey.bind(this, revisionKey))
          .then(this._activateRevision.bind(this, consul, revisionKey))
          .then(this._activationSuccess.bind(this, namespace, revisionKey));
      },

      fetchRevisions: function(context) {
        var consul = context._consul;

        return Promise.hash({
            revisions: consul.recentRevisionKeys(),
            activeRevision: consul.getActiveRevision()
          })
          .then(function(result) {
            return result.revisions.map(function(revisionKey) {
              return {
                revision: revisionKey,
                active: revisionKey === result.activeRevision
              };
            });
          })
        .then(function(revisions) {
          return {
            revisions: revisions
          };
        });
      },

      _determineIfShouldUpload: function(consul, revisionKey, shouldOverwrite) {
        return consul.keysForRevision(revisionKey)
          .then(function(keys) {
            if (!keys || keys.length === 0 || shouldOverwrite) {
              return Promise.resolve();
            }

            return Promise.reject('Revision already exists');
          }, function() {
            return Promise.resolve();
          });
      },

      _readFileContents: function(path) {
        return readFile(path)
          .then(function(buffer) {
            return Promise.resolve(buffer.toString());
          }, function() {
            return Promise.reject('No file found at `' + path + '`');
          });
      },

      _uploadRevision: function(consul, revisionKey, data) {
        return consul.setRevision(revisionKey, data);
      },

      _uploadMetadata: function(consul, revisionKey, metadata) {
        return consul.setRevisionMetadata(revisionKey, metadata);
      },

      _updateRecentRevisions: function(consul, revisionKey) {
        return consul.recentRevisionKeys()
          .then(function(revisionKeys) {
            if (revisionKeys.indexOf(revisionKey) === -1) {
              revisionKeys.unshift(revisionKey);

            }

            return consul.setRecentRevisions(revisionKeys.join(','));
          });
      },

      _trimRecentRevisions: function(consul, maxRevisions) {
        return consul.recentRevisionKeys()
          .then(function(revisionKeys) {
            if (!revisionKeys.length || revisionKeys.length <= maxRevisions) {
              return Promise.resolve();
            }

            var remaining = revisionKeys.splice(0, maxRevisions);

            return consul.setRecentRevisions(remaining.join(','))
              .then(function() {
                  return Promise.all(revisionKeys.map(function(revisionKey) {
                    return consul.deleteRevision(revisionKey);
                  }, []));
              });
          });
      },

      _uploadSuccess: function(revisionKey) {
        var namespace = this.readConfig('namespaceToken');
        this.log('Uploaded with key `' + revisionKey + '` into namespace `' + namespace + '`', { verbose: true });
        return Promise.resolve();
      },

      _validateRevisionKey: function(revisionKey, recentRevisions) {
        if (!revisionKey) {
          return Promise.reject('Revision key to activate must be provided');
        }

        if (recentRevisions.indexOf(revisionKey) > -1) {
          return Promise.resolve();
        } else {
          return Promise.reject('Unknown revision key');
        }
      },

      _activateRevision: function(consul, revisionKey) {
        return consul.setActiveRevision(revisionKey);
      },

      _activationSuccess: function(namespace, revisionKey) {
        this.log('✔ Activated revision `' + revisionKey + '` in namespace `' + namespace + '`', { verbose: true });

        return Promise.resolve();
      }
    });

    return new Plugin();
  }
};
