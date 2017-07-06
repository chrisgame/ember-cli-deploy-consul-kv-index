/* jshint node: true */

var fs        = require('fs');
var path      = require('path');
var denodeify = require('rsvp').denodeify;
var readFile  = denodeify(fs.readFile);
var consulLib = require('consul');
var Consul    = require('./lib/consul');

var RSVP      = require('rsvp');

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
        token: null,
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
        revisionKeyToActivate: function(context, pluginHelper) {
          if (context.commandOptions && context.commandOptions.activate) {
            return pluginHelper.readConfig('revisionKey');
          }

          return (context.commandOptions && context.commandOptions.revision);
        },
        metadata: function(context) {
          return context.revisionData || {};
        },
        aliases: [],
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
        var token   = this.readConfig('token');

        var options = {
          host: host,
          port: port,
          secure: secure,
          promisify: true,
          defaults: {}
        };

        if (token) {
          options.defaults.token = token;
        }

        var client;

        if (context._consulLib) {
          client = context._consulLib;
        } else {
          client = consulLib(options).kv;
        }

        var consul = new Consul(client, namespaceToken, recentRevisionsToken, activeRevisionToken);

        context[this.name] = { _consul: consul };
      },

      upload: function(context) {
        var allowOverwrite = this.readConfig('allowOverwrite');
        var maxRevisions   = this.readConfig('maxRevisions');
        var revisionKey    = this.readConfig('revisionKey');
        var aliases        = this.readConfig('aliases');
        var metadata       = this.readConfig('metadata');

        var distDir     = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath    = path.join(distDir, filePattern);

        var consul = context[this.name]._consul;

        this.log('Uploading `' + filePath + '`', { verbose: true });

        return this._determineIfShouldUpload(consul, revisionKey, allowOverwrite)
          .then(this._readFileContents.bind(this, filePath))
          .then(this._uploadRevision.bind(this, consul, revisionKey))
          .then(this._uploadMetadata.bind(this, consul, revisionKey, metadata))
          .then(this._updateAliases.bind(this, consul, revisionKey, aliases))
          .then(this._updateRecentRevisions.bind(this, consul, revisionKey))
          .then(this._trimRecentRevisions.bind(this, consul, maxRevisions))
          .then(this._uploadSuccess.bind(this, revisionKey));
      },

      activate: function(context) {
        var namespace   = this.readConfig('namespaceToken');
        var revisionKey = this.readConfig('revisionKeyToActivate');

        var consul = context[this.name]._consul;

        this.log('Activating revision `' + revisionKey + '` in namespace `' + namespace + '`', { verbose: true });

        return consul.recentRevisionKeys()
          .then(this._validateRevisionKey.bind(this, revisionKey))
          .then(this._activateRevision.bind(this, consul, revisionKey))
          .then(this._activationSuccess.bind(this, namespace, revisionKey));
      },

      fetchRevisions: function(context) {
        var consul = context[this.name]._consul;

        return RSVP.hash({
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
              return RSVP.resolve();
            }

            return RSVP.reject('Revision already exists');
          }, function() {
            return RSVP.resolve();
          });
      },

      _readFileContents: function(path) {
        return readFile(path)
          .then(function(buffer) {
            return RSVP.resolve(buffer.toString());
          }, function() {
            return RSVP.reject('No file found at `' + path + '`');
          });
      },

      _uploadRevision: function(consul, revisionKey, data) {
        return consul.setRevision(revisionKey, data);
      },

      _updateAliases: function(consul, revisionKey, aliases) {
        if (aliases.indexOf(revisionKey) === -1) {
          aliases.push(revisionKey);
        }

        return aliases.reduce(function(promise, alias) {
          return promise.then(consul.updateAlias.bind(consul, revisionKey, alias));
        }, RSVP.resolve());
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

            return consul.setRecentRevisions(revisionKeys);
          });
      },

      _trimRecentRevisions: function(consul, maxRevisions) {
        var self = this;

        return consul.recentRevisionKeys()
          .then(function(revisionKeys) {
            if (!revisionKeys.length || revisionKeys.length <= maxRevisions) {
              return RSVP.resolve();
            }

            return consul.getActiveRevision()
              .then(self._determineKeysToRemove.bind(self, maxRevisions, revisionKeys))
              .then(self._cleanUpKeys.bind(self, consul));
          });
      },

      _determineKeysToRemove: function(maxRevisions, revisionKeys, activeRevision) {
        var numberToRemove = revisionKeys.length - maxRevisions;

        var obj = revisionKeys.reverse().reduce(function(obj, key) {
          if ((obj.toRemove.length === numberToRemove) || key === activeRevision) {
            obj.toKeep.push(key);
          } else {
            obj.toRemove.push(key);
          }

          return obj;
        }, { toRemove: [], toKeep: [] });

        return RSVP.resolve(obj);
      },

      _cleanUpKeys: function(consul, obj) {
        var toKeep   = obj.toKeep.reverse();
        var toRemove = obj.toRemove;

        return consul.setRecentRevisions(toKeep)
          .then(function() {
              return RSVP.all(toRemove.map(function(revisionKey) {
                return consul.deleteRevision(revisionKey);
              }, []));
          });
      },

      _uploadSuccess: function(revisionKey) {
        var namespace = this.readConfig('namespaceToken');
        this.log('Uploaded with key `' + revisionKey + '` into namespace `' + namespace + '`', { verbose: true });
        return RSVP.resolve();
      },

      _validateRevisionKey: function(revisionKey, recentRevisions) {
        if (!revisionKey) {
          return RSVP.reject('Revision key to activate must be provided');
        }

        if (recentRevisions.indexOf(revisionKey) > -1) {
          return RSVP.resolve();
        } else {
          return RSVP.reject('Unknown revision key');
        }
      },

      _activateRevision: function(consul, revisionKey) {
        return consul.setActiveRevision(revisionKey);
      },

      _activationSuccess: function(namespace, revisionKey) {
        this.log('✔ Activated revision `' + revisionKey + '` in namespace `' + namespace + '`', { verbose: true });

        return RSVP.resolve();
      }
    });

    return new Plugin();
  }
};
