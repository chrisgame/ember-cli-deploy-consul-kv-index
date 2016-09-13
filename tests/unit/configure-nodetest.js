/* jshint node: true */

var subject = require('../../index');
var assert  = require('../helpers/assert');

describe('Consul KV Index | configure hook', function() {
  var mockUi;

  beforeEach(function() {
    mockUi = {
      verbose: true,
      messages: [],
      write: function() { },
      writeLine: function(message) {
        this.messages.push(message);
      }
    };
  });

  describe('default config', function() {
    it('uses user provided config if provided', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var config = {
        port: 1234
      };

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': config
        }
      };

      instance.beforeHook(context);
      instance.configure(context);
      assert.equal(instance.readConfig('port'), 1234);
    });

    it('uses the default config if user provided config is missing', function() {
      var instance = subject.createDeployPlugin({
        name: 'consul-kv-index'
      });

      var context = {
        ui: mockUi,
        config: {
          'consul-kv-index': {}
        }
      };

      instance.beforeHook(context);
      instance.configure(context);
      assert.equal(instance.readConfig('port'), 8500);
    });

    describe('distDir', function() {
      it('reads from the context if it exists', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          },
          distDir: 'foo/bar'
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('distDir'), 'foo/bar');
      });

      it('uses default if data from the context does not exist', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('distDir'), 'tmp/deploy-dist');
      });
    });

    describe('namespace', function() {
      it('reads from the context if it exists', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          },
          project: {
            name: function() {
              return 'foo-bar';
            }
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('namespaceToken'), 'foo-bar');
      });

      it('uses default if data from the context does not exist', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('namespaceToken'), 'missing-namespace');
      });
    });

    describe('revisionKey', function() {
      it('reads from the context if it exists', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          },
          revisionData: {
            revisionKey: 'foo'
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('revisionKey'), 'foo');
      });

      it('uses default if data from the context does not exist', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('revisionKey'), 'missing-revision-key');
      });
    });

    describe('revisionKeyToActivate', function() {
      it('reads from the context if it exists', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          },
          commandOptions: {
            revision: 'bar'
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('revisionKeyToActivate'), 'bar');
      });

      it('uses `undefined` if data from the context does not exist', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.equal(instance.readConfig('revisionKeyToActivate'), undefined);
      });
    });

    describe('metadata', function() {
      it('reads from the context if it exists', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          },
          revisionData: {
            foo: 'bar'
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.deepEqual(instance.readConfig('metadata'), { foo: 'bar' });
      });

      it('uses default value if data from the context does not exist', function() {
        var instance = subject.createDeployPlugin({
          name: 'consul-kv-index'
        });

        var context = {
          ui: mockUi,
          config: {
            'consul-kv-index': {}
          }
        };

        instance.beforeHook(context);
        instance.configure(context);
        assert.deepEqual(instance.readConfig('metadata'), {});
      });
    });
  });
});
