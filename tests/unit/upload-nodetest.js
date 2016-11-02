/* jshint node: true */

var subject = require('../../index');
var assert  = require('../helpers/assert');
var consulClient = require('../helpers/mock-consul-client');

describe('Consul KV Index | upload hook', function() {
  var mockUi;

  beforeEach(function() {
    consulClient.reset();

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
        namespaceToken: 'foo',
        revisionKey: '1234'
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      consulClient.store['foo/revisions/1234'] = 'aaa';

      return assert.isRejected(instance.upload(context))
        .then(function(message) {
          assert.equal(message, 'Revision already exists');
        });
    });

    it('will not upload if the file does not exist', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: 'bogus-dir',
        filePattern: 'foo.txt'
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isRejected(instance.upload(context))
        .then(function(message) {
          assert.equal(message, 'No file found at `bogus-dir/foo.txt`');
        });
    });

    it('uploads the file and metadata', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          var key = 'foo/revisions/1234';
          assert.equal(consulClient.store[key].trim(), 'bar');

          var metadata = JSON.parse(consulClient.store[key + '/metadata'].trim());
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
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      consulClient.store['foo/recent-revisions'] = 'aaa,bbb';

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(consulClient.store[key], '1234,aaa,bbb');
        });
    });

    it('doesn\'t update recent revisions if revision already present', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      consulClient.store['foo/recent-revisions'] = 'aaa,1234,bbb';

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(consulClient.store[key], 'aaa,1234,bbb');
        });
    });

    it('sets the recent revisions list if it doesn\'t exist already', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        metadata: {
          baz: 'bop'
        }
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          var key = 'foo/recent-revisions';
          assert.equal(consulClient.store[key], '1234');
        });
    });

    describe('trimming old revisions', function() {
      it('trims the recent revisons if longer than maxRevisions', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var config = {
          namespaceToken: 'foo',
          revisionKey: '1234',
          distDir: process.cwd() + '/tests/fixtures/dist',
          filePattern: 'foo.txt',
          maxRevisions: 3,
          metadata: {
            baz: 'bop'
          }
        };

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': config
          },
          _consulLib: consulClient
        };

        consulClient.store['foo/recent-revisions'] = 'aaa,bbb,ccc';

        consulClient.store['foo/aliases/aaa'] = 'aaa';
        consulClient.store['foo/aliases/xxx'] = 'aaa';
        consulClient.store['foo/revisions/aaa'] = '111';
        consulClient.store['foo/revisions/aaa/metadata'] = '{"foo": 111}';
        consulClient.store['foo/revisions/aaa/aliases'] = 'aaa,xxx';

        consulClient.store['foo/aliases/bbb'] = 'bbb';
        consulClient.store['foo/aliases/yyy'] = 'bbb';
        consulClient.store['foo/revisions/bbb'] = '222';
        consulClient.store['foo/revisions/bbb/metadata'] = '{"foo": 222}';
        consulClient.store['foo/revisions/bbb/aliases'] = 'bbb,yyy';

        consulClient.store['foo/aliases/ccc'] = 'ccc';
        consulClient.store['foo/aliases/zzz'] = 'ccc';
        consulClient.store['foo/revisions/ccc'] = '333';
        consulClient.store['foo/revisions/ccc/metadata'] = '{"foo": 333}';
        consulClient.store['foo/revisions/ccc/aliases'] = 'ccc,zzz';

        instance.beforeHook(context);
        instance.configure(context);
        instance.setup(context);

        return assert.isFulfilled(instance.upload(context))
          .then(function() {
            var key = 'foo/recent-revisions';
            assert.equal(consulClient.store[key], '1234,aaa,bbb');
            assert.isUndefined(consulClient.store['foo/revisions/ccc']);
            assert.isUndefined(consulClient.store['foo/revisions/ccc/metadata']);
            assert.isUndefined(consulClient.store['foo/revisions/ccc/aliases']);
            assert.isUndefined(consulClient.store['foo/aliases/ccc']);
            assert.isUndefined(consulClient.store['foo/aliases/zzz']);
          });
      });

      it('keeps the active revision even if it\'s marked for removal', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var config = {
          namespaceToken: 'foo',
          revisionKey: '1234',
          distDir: process.cwd() + '/tests/fixtures/dist',
          filePattern: 'foo.txt',
          maxRevisions: 4,
          metadata: {
            baz: 'bop'
          }
        };

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': config
          },
          _consulLib: consulClient
        };

        consulClient.store['foo/recent-revisions'] = 'aaa,bbb,ccc,ddd';
        consulClient.store['foo/active-revision'] = 'ddd';
        consulClient.store['foo/revisions/aaa'] = '111';
        consulClient.store['foo/revisions/aaa/metadata'] = '{"foo": 111}';
        consulClient.store['foo/revisions/bbb'] = '222';
        consulClient.store['foo/revisions/bbb/metadata'] = '{"foo": 222}';
        consulClient.store['foo/revisions/ccc'] = '333';
        consulClient.store['foo/revisions/ccc/metadata'] = '{"foo": 333}';
        consulClient.store['foo/revisions/ddd'] = '444';
        consulClient.store['foo/revisions/ddd/metadata'] = '{"foo": 444}';

        instance.beforeHook(context);
        instance.configure(context);
        instance.setup(context);

        return assert.isFulfilled(instance.upload(context))
          .then(function() {
            var key = 'foo/recent-revisions';
            assert.equal(consulClient.store[key], '1234,aaa,bbb,ddd');
            assert.isUndefined(consulClient.store['foo/revisions/ccc']);
            assert.isUndefined(consulClient.store['foo/revisions/ccc/metadata']);
          });
      });
    });
  });

  describe('maintaining aliases', function() {
    it('sets the alias keys for a revision', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '1234',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        aliases: ['my-branch']
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          assert.equal(consulClient.store['foo/revisions/1234/aliases'], 'my-branch,1234');
          assert.equal(consulClient.store['foo/aliases/1234'], '1234');
          assert.equal(consulClient.store['foo/aliases/my-branch'], '1234');
        });
    });

    it('updates the alias keys for a revision', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        namespaceToken: 'foo',
        revisionKey: '9999',
        distDir: process.cwd() + '/tests/fixtures/dist',
        filePattern: 'foo.txt',
        aliases: ['my-branch']
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        },
        _consulLib: consulClient
      };

      consulClient.store['foo/revisions/1234/aliases'] = '1234,my-branch';
      consulClient.store['foo/aliases/1234'] = '1234';
      consulClient.store['foo/aliases/my-branch'] = '1234';

      instance.beforeHook(context);
      instance.configure(context);
      instance.setup(context);

      return assert.isFulfilled(instance.upload(context))
        .then(function() {
          assert.equal(consulClient.store['foo/revisions/1234/aliases'], '1234');
          assert.equal(consulClient.store['foo/aliases/1234'], '1234');

          assert.equal(consulClient.store['foo/revisions/9999/aliases'], 'my-branch,9999');
          assert.equal(consulClient.store['foo/aliases/9999'], '9999');
          assert.equal(consulClient.store['foo/aliases/my-branch'], '9999');
        });
    });
  });
});
