/* jshint node: true */

var Promise = require('rsvp').Promise;

var consulClient = {
  store: {},

  reset: function() {
    this.store = {};
  },

  keys: function() {
    return Promise.resolve(Object.keys(this.store));
  },
  set: function(key, data) {
    this.store[key] = data;
    return Promise.resolve();
  },
  get: function(key) {
    if (this.store[key]) {
      return Promise.resolve({
        'Value': this.store[key]
      });
    } else {
      return Promise.resolve();
    }
  },
  del: function(options) {
    delete this.store[options.key];
    delete this.store[options.key + '/metadata'];
    delete this.store[options.key + '/aliases'];
    return Promise.resolve();
  }
};

module.exports = consulClient;
