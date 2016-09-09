/* jshint node: true */

var subject = require('../../index');
var assert  = require('../helpers/assert');

describe('Consul KV Index plugin', function() {
  it('has a name', function() {
    var instance = subject.createDeployPlugin({
      name: 'foo'
    });

    assert.equal(instance.name, 'foo');
  });

  it('implements the correct hooks', function() {
    var plugin = subject.createDeployPlugin({
      name: 'foo'
    });

    assert.isDefined(plugin.setup);
    assert.isFunction(plugin.setup);

    assert.isDefined(plugin.upload);
    assert.isFunction(plugin.upload);

    assert.isDefined(plugin.activate);
    assert.isFunction(plugin.activate);
  });
});
