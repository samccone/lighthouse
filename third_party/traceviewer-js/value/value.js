/**
Copyright (c) 2015 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../base/guid.js");
require("../base/iteration_helpers.js");
require("../base/utils.js");

'use strict';

global.tr.exportTo('tr.v', function() {
  function Value(canonicalUrl, name, opt_options, opt_groupingKeys,
                 opt_diagnostics) {
    if (typeof(name) !== 'string')
      throw new Error('Expected value_name grouping key to be provided');

    // Allow callers to re-use groupingKeys dictionaries.
    this.groupingKeys = {name: name};
    if (opt_groupingKeys) {
      for (var keyName in opt_groupingKeys) {
        this.addGroupingKey(keyName, opt_groupingKeys[keyName]);
      }
    }

    this.diagnostics = opt_diagnostics || {};

    // May be undefined
    this.diagnostics.canonical_url = canonicalUrl;

    var options = opt_options || {};
    this.description = options.description;
    this.important = options.important !== undefined ?
        options.important : false;
  }

  Value.fromDict = function(d) {
    if (d.type === 'numeric')
      return NumericValue.fromDict(d);

    if (d.type === 'dict')
      return DictValue.fromDict(d);

    if (d.type == 'failure')
      return FailureValue.fromDict(d);

    if (d.type === 'skip')
      return SkipValue.fromDict(d);

    throw new Error('Not implemented');
  };

  Value.prototype = {
    get name() {
      return this.groupingKeys.name;
    },

    get canonicalUrl() {
      return this.diagnostics.canonical_url;
    },

    addGroupingKey: function(keyName, key) {
      if (keyName === 'name')
        throw new Error('Invalid groupingKey name "name"');

      if (this.groupingKeys.hasOwnProperty(keyName))
        throw new Error('Tried to redefine grouping key ' + keyName);

      this.groupingKeys[keyName] = key;
    },

    asDict: function() {
      return this.asJSON();
    },

    asJSON: function() {
      var d = {
        grouping_keys: tr.b.cloneDictionary(this.groupingKeys),
        description: this.description,
        important: this.important,
        diagnostics: this.diagnostics
      };

      this._asDictInto(d);
      if (d.type === undefined)
        throw new Error('_asDictInto must set type field');
      return d;
    },

    _asDictInto: function(d) {
      throw new Error('Not implemented');
    }
  };

  function NumericValue(canonicalUrl, name, numeric, opt_options,
                        opt_groupingKeys, opt_diagnostics) {
    if (!(numeric instanceof tr.v.NumericBase))
      throw new Error('Expected numeric to be instance of tr.v.NumericBase');

    Value.call(this, canonicalUrl, name, opt_options, opt_groupingKeys,
               opt_diagnostics);
    this.numeric = numeric;
  }

  NumericValue.fromDict = function(d) {
    if (d.numeric === undefined)
      throw new Error('Expected numeric to be provided');
    var numeric = tr.v.NumericBase.fromDict(d.numeric);
    var name = d.grouping_keys.name;
    d.grouping_keys = tr.b.cloneDictionary(d.groupingKeys);
    delete d.grouping_keys.name;
    return new NumericValue(d.diagnostics.canonical_url, name,
                            numeric, d, d.grouping_keys, d.diagnostics);
  };

  NumericValue.prototype = {
    __proto__: Value.prototype,

    _asDictInto: function(d) {
      d.type = 'numeric';
      d.numeric = this.numeric.asDict();
    }
  };

  function DictValue(canonicalUrl, name, value, opt_options, opt_groupingKeys,
                     opt_diagnostics) {
    Value.call(this, canonicalUrl, name, opt_options, opt_groupingKeys,
               opt_diagnostics);
    this.value = value;
  }

  DictValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    if (d.value === undefined)
      throw new Error('Expected value to be provided');
    var name = d.grouping_keys.name;
    d.grouping_keys = tr.b.cloneDictionary(d.groupingKeys);
    delete d.grouping_keys.name;
    return new DictValue(d.diagnostics.canonical_url, name,
                         d.value, d, d.groupingKeys, d.diagnostics);
  };

  DictValue.prototype = {
    __proto__: Value.prototype,

    _asDictInto: function(d) {
      d.type = 'dict';
      d.value = this.value;
    }
  };


  function FailureValue(canonicalUrl, name, opt_options, opt_groupingKeys,
                        opt_diagnostics) {
    var options = opt_options || {};

    var stack;
    if (options.stack === undefined) {
      if (options.stack_str === undefined) {
        throw new Error('Expected stack_str or stack to be provided');
      } else {
        stack = options.stack_str;
      }
    } else {
      stack = options.stack;
    }

    if (typeof stack !== 'string')
      throw new Error('stack must be provided as a string');

    if (canonicalUrl === undefined) {
      throw new Error('FailureValue must provide canonicalUrl');
    }

    Value.call(this, canonicalUrl, name, options, opt_groupingKeys,
               opt_diagnostics);
    this.stack = stack;
  }

  FailureValue.fromError = function(canonicalUrl, e) {
    var ex = tr.b.normalizeException(e);
    return new FailureValue(canonicalUrl, ex.typeName,
                            {description: ex.message,
                             stack: ex.stack});

  };

  FailureValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    if (d.stack_str === undefined)
      throw new Error('Expected stack_str to be provided');
    var name = d.grouping_keys.name;
    d.grouping_keys = tr.b.cloneDictionary(d.groupingKeys);
    delete d.grouping_keys.name;
    return new FailureValue(d.diagnostics.canonical_url, name,
                            d, d.grouping_keys, d.diagnostics);
  };

  FailureValue.prototype = {
    __proto__: Value.prototype,

    _asDictInto: function(d) {
      d.type = 'failure';
      d.stack_str = this.stack;
    }
  };


  function SkipValue(canonicalUrl, name, opt_options, opt_groupingKeys,
                     opt_diagnostics) {
    Value.call(this, canonicalUrl, name, opt_options, opt_groupingKeys,
               opt_diagnostics);
  }

  SkipValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    var name = d.grouping_keys.name;
    d.grouping_keys = tr.b.cloneDictionary(d.groupingKeys);
    delete d.grouping_keys.name;
    return new SkipValue(d.diagnostics.canonical_url, name,
                         d, d.grouping_keys, d.diagnostics);
  };

  SkipValue.prototype = {
    __proto__: Value.prototype,

    _asDictInto: function(d) {
      d.type = 'skip';
    }
  };


  return {
    Value: Value,
    NumericValue: NumericValue,
    DictValue: DictValue,
    FailureValue: FailureValue,
    SkipValue: SkipValue
  };
});
