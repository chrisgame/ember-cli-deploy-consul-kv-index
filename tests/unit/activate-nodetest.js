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

  it('raises an error if a revision key is not provided', function() {
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

    consulClient.store['foo/recent-revisions'] = '1234';

    return assert.isRejected(instance.activate(context))
      .then(function(message) {
        assert.equal(message, 'Revision key to activate must be provided');
      });
  });

  it('raises an error if the specified revision key is unknown', function() {
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
      commandOptions: {
        revision: 'abcd'
      },
      _consulLib: consulClient
    };

    instance.beforeHook(context);
    instance.configure(context);
    instance.setup(context);

    consulClient.store['foo/recent-revisions'] = '1234';

    return assert.isRejected(instance.activate(context))
      .then(function(message) {
        assert.equal(message, 'Unknown revision key');
      });
  });

  it('activates the revision', function() {
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
      commandOptions: {
        revision: '1234'
      },
      _consulLib: consulClient
    };

    instance.beforeHook(context);
    instance.configure(context);
    instance.setup(context);

    consulClient.store['foo/recent-revisions'] = '1234';
    consulClient.store['foo/active-revision'] = 'qwerty';

    return assert.isFulfilled(instance.activate(context))
      .then(function() {
        assert.equal(mockUi.messages.pop(), '\u001b[34m- ✔ Activated revision `1234` in namespace `foo`\u001b[39m');
      });
  });
});
