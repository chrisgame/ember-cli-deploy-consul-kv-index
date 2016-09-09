/* jshint node: true */

var subject = require('../../index');
var assert  = require('../helpers/assert');

var Promise = require('ember-cli/lib/ext/promise');

describe('Consul KV Index | upload hook', function() {
  var mockUi, store;

  beforeEach(function() {
    store = {};

    mockUi = {
      verbose: true,
      messages: [],
      write: function() { },
      writeLine: function(message) {
        this.messages.push(message);
      }
    };
  });

  describe('uploading a file', function() {
    it('will not upload if the revision already exists and allowOverwrite is false', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        allowOverwrite: false,
        namespace: 'foo',
        revisionKey: '1234',
        consulClient: {
          keys: function(key) {
            return Promise.resolve([key]);
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isRejected(instance.upload())
        .then(function(message) {
          assert.equal(message, 'Revision already exists');
        });
    });

    it('will not upload if the file does not exist', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: 'bogus-dir',
        filePattern: 'foo.txt',
        consulClient: {
          keys: function() {
            return Promise.resolve();
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isRejected(instance.upload())
        .then(function(message) {
          assert.equal(message, 'No file found at `bogus-dir/foo.txt`');
        });
    });

    it('uploads the file and metadata', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        },
        consulClient: {
          keys: function() {
            return Promise.resolve(Object.keys(store));
          },
          set: function(key, data) {
            store[key] = data;
            return Promise.resolve();
          },
          get: function(key) {
            if (store[key]) {
              return Promise.resolve({
                'Value': store[key]
              });
            } else {
              return Promise.resolve();
            }
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isFulfilled(instance.upload())
        .then(function() {
          var key = 'foo/revisions/1234';
          assert.equal(store[key].trim(), 'bar');

          var metadata = JSON.parse(store[key + '/metadata'].trim());
          assert.deepEqual(metadata, { baz: 'bop' });
        });
    });
  });

  describe('maintaining recent revisions', function() {
    it('updates recent revisions list', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        },
        consulClient: {
          keys: function() {
            return Promise.resolve(Object.keys(store));
          },
          set: function(key, data) {
            store[key] = data;
            return Promise.resolve();
          },
          get: function(key) {
            if (store[key]) {
              return Promise.resolve({
                'Value': store[key]
              });
            } else {
              return Promise.resolve();
            }
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      store['foo/recent-revisions'] = 'aaa,bbb';

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isFulfilled(instance.upload())
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(store[key], '1234,aaa,bbb');
        });
    });

    it('doesn\'t update recent revisions if revision already present', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        },
        consulClient: {
          keys: function() {
            return Promise.resolve(Object.keys(store));
          },
          set: function(key, data) {
            store[key] = data;
            return Promise.resolve();
          },
          get: function(key) {
            if (store[key]) {
              return Promise.resolve({
                'Value': store[key]
              });
            } else {
              return Promise.resolve();
            }
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      store['foo/recent-revisions'] = 'aaa,1234,bbb';

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isFulfilled(instance.upload())
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(store[key], 'aaa,1234,bbb');
        });
    });

    it('sets the recent revisions list if it doesn\'t exist already', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        },
        consulClient: {
          keys: function() {
            return Promise.resolve(Object.keys(store));
          },
          set: function(key, data) {
            store[key] = data;
            return Promise.resolve();
          },
          get: function(key) {
            if (store[key]) {
              return Promise.resolve({
                'Value': store[key]
              });
            } else {
              return Promise.resolve();
            }
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isFulfilled(instance.upload())
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(store[key], '1234');
        });
    });

    it('trims the recent revisons if longer than maxRevisions', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespace: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        maxRevisions: 3,
        metadata: {
          baz: 'bop'
        },
        consulClient: {
          keys: function() {
            return Promise.resolve(Object.keys(store));
          },
          set: function(key, data) {
            store[key] = data;
            return Promise.resolve();
          },
          get: function(key) {
            if (store[key]) {
              return Promise.resolve({
                'Value': store[key]
              });
            } else {
              return Promise.resolve();
            }
          },
          del: function(options) {
            delete store[options.key];
            delete store[options.key + '/metadata'];
            return Promise.resolve();
          }
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      store['foo/recent-revisions'] = 'aaa,bbb,ccc';
      store['foo/revisions/aaa'] = '111';
      store['foo/revisions/aaa/metadata'] = '{"foo": 111}';
      store['foo/revisions/bbb'] = '222';
      store['foo/revisions/bbb/metadata'] = '{"foo": 222}';
      store['foo/revisions/ccc'] = '333';
      store['foo/revisions/ccc/metadata'] = '{"foo": 333}';

      instance.beforeHook(context);
      instance.configure(context);

      return assert.isFulfilled(instance.upload())
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(store[key], '1234,aaa,bbb');
          assert.isUndefined(store['foo/revisions/ccc']);
          assert.isUndefined(store['foo/revisions/ccc/metadata']);
        });
    });
  });
});
