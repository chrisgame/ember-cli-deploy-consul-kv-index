/* jshint node: true */

var subject = require('../../index');
var assert  = require('../helpers/assert');
var consulClient = require('../helpers/mock-consul-client');

describe('Consul KV Index | activate hook', function() {
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

  it('returns the list of recent revisions', function() {
    var instance = subject.createDeployPlugin({
      name: 'consul-kv-index'
    });

    var config = {
      namespaceToken: 'foo'
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

    consulClient.store['foo/recent-revisions'] = 'foo,bar,baz';
    consulClient.store['foo/active-revision'] = 'bar';

    return assert.isFulfilled(instance.fetchRevisions(context))
      .then(function(result) {
        assert.equal(result.revisions.length, 3);
        assert.equal(result.revisions[0].revision, 'foo');
        assert.equal(result.revisions[0].active, false);
        assert.equal(result.revisions[1].revision, 'bar');
        assert.equal(result.revisions[1].active, true);
        assert.equal(result.revisions[2].revision, 'baz');
        assert.equal(result.revisions[2].active, false);
      });
  });
});
