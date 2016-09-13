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

    return this._client.set(key, value);
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

  _get: function(key) {
    return this._client.get(key)
      .then(function(result) {
        var value = (result && result['Value']) || null;

        return Promise.resolve(value);
      });
  }
});
