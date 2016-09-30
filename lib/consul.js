/* jshint node: true */

var CoreObject = require('core-object');
var Promise    = require('ember-cli/lib/ext/promise');

module.exports = CoreObject.extend({
  init: function(client, namespaceToken, recentRevisionsToken, activeRevisionToken) {
    this._super();

    this._client = client;
    this._namespaceToken = namespaceToken;
    this._recentRevisionsToken = recentRevisionsToken;
    this._activeRevisionToken = activeRevisionToken;
  },

  keysForRevision: function(revisionKey) {
    var key = this._namespaceToken + '/revisions/' + revisionKey;

    return this._client.keys(key);
  },

  setRevision: function(revisionKey, value) {
    var key = this._namespaceToken + '/revisions/' + revisionKey;

    return this._client.set(key, value);
  },

  updateAlias: function(revisionKey, alias) {
    return this._getAliasValue(alias)
      .then(this._unlinkAliasFromRevision.bind(this, alias))
      .then(this._updateAlias.bind(this, revisionKey, alias));
  },

  setRevisionMetadata: function(revisionKey, value) {
    var key = this._namespaceToken + '/revisions/' + revisionKey + '/metadata';

    return this._client.set(key, JSON.stringify(value));
  },

  recentRevisionKeys: function() {
    return this._getRecentRevisions(this._namespaceToken)
      .then(function(result) {
        var value = (result && result.split(',')) || [];

        return Promise.resolve(value);
      });
  },

  setRecentRevisions: function(value) {
    var key = this._namespaceToken + '/' + this._recentRevisionsToken;

    return this._client.set(key, value.join(','));
  },

  deleteRevision: function(revisionKey) {
    var key = this._namespaceToken + '/revisions/' + revisionKey;
    return this._client.del({ key: key, recurse: true });
  },

  setActiveRevision: function(revisionKey) {
    var key = this._namespaceToken + '/' + this._activeRevisionToken;

    return this._client.set(key, revisionKey);
  },

  getActiveRevision: function() {
    var key = this._namespaceToken + '/' + this._activeRevisionToken;

    return this._get(key);
  },

  _getRecentRevisions: function() {
    var key = this._namespaceToken + '/' + this._recentRevisionsToken;

    return this._get(key);
  },

  _getAliasValue: function(alias) {
    var key = this._namespaceToken + '/aliases/' + alias;

    return this._get(key);
  },

  _setAliasValue: function(alias, value) {
    var key = this._namespaceToken + '/aliases/' + alias;

    return this._client.set(key, value);
  },

  _unlinkAliasFromRevision: function(alias, revisionKey) {
    if (!revisionKey) {
      return Promise.resolve();
    }

    return this._getLinkedAliasesForRevision(revisionKey)
      .then(function(aliases) {
        var index = aliases.indexOf(alias);

        if (index > -1) {
          aliases.splice(index, 1);
        }

        return Promise.resolve(aliases);
      })
      .then(this._setLinkedAliasesForRevision.bind(this, revisionKey));
  },

  _getLinkedAliasesForRevision: function(revisionKey) {
    var key = this._namespaceToken + '/revisions/' + revisionKey + '/aliases';

    return this._get(key)
      .then(function(result) {
        var value = (result && result.split(',')) || [];

        return Promise.resolve(value);
      });
  },

  _setLinkedAliasesForRevision: function(revisionKey, aliases) {
    var key = this._namespaceToken + '/revisions/' + revisionKey + '/aliases';
    aliases = aliases || [];

    if (!aliases.length) {
      return this._client.del({ key: key, recurse: true });
    }

    return this._client.set(key, aliases.join(','));
  },

  _updateAlias: function(revisionKey, alias) {
    return this._getLinkedAliasesForRevision(revisionKey)
      .then(function(aliases) {
        if (aliases.indexOf(alias) === -1) {
          aliases.push(alias);
        }

        return Promise.all([
          this._setLinkedAliasesForRevision(revisionKey, aliases),
          this._setAliasValue(alias, revisionKey)
        ]);
      }.bind(this));
  },

  _get: function(key) {
    return this._client.get(key)
      .then(function(result) {
        var value = (result && result['Value']) || null;

        return Promise.resolve(value);
      });
  }
});
