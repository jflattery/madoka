/*
*
 The MIT License (MIT)

 Copyright (c) 2010-2015 Allenice

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
* */

var fs = require('fs'),
    path = require('path');

var faker = require('./lib/faker'),
    fakerFuncNames = Object.keys(faker),
    fakerFuncs = [],
    _ = require('lodash'),
    mkdirp = require('mkdirp');

fakerFuncNames.forEach(function(name) {
  fakerFuncs.push(faker[name]);
});

// match {{  }}
var interpolateReg = /{{([\s\S]+?)}}/g;

// parsers of different data type
var parsers = {

  // parse string template, if the parent template is an array, it will pass the index value to the child template
  '_string': function(str, index) {
    // replace {{ xxx }}
    var obj = this
    str = str.replace(interpolateReg, function(match, interpolate) {
      try {
        /*jslint evil: true */
        var funcNames = ['','index'].concat(fakerFuncNames).concat(['return ' + interpolate + ';']),
        func = new (Function.prototype.bind.apply(Function, funcNames)),
        funcs = [function(){return index}].concat(fakerFuncs);

        return func.apply(obj, funcs);
        
      } catch(e)  {
        return e.message;
      }
    });

    // if result is true or false, parse it to boolean
    if(/^(true|false)$/.test(str)) {
      str = str === 'true';
    }

    // if result is digit, parse it to float
    if(/^[-+]?\d*\.?\d+$/.test(str)) {
      str = parseFloat(str);
    }

    return str;
  },

  // parse object, it will generate each property
  '_object': function(obj, index) {
    var funcKey = [];

    for(var key in obj) {
      if(obj.hasOwnProperty(key)) {

        // If this is a function, generate it later.
        if(typeof obj[key] === 'function') {
          funcKey.push(key);
          continue;
        }
        obj[key] = generate.call(obj, obj[key], index);
      }
    }

    // parse function
    funcKey.forEach(function(key) {
      obj[key] = generate.call(obj, obj[key], index);
    });

    return obj;
  },

  // parse array
  '_array': function(arr) {
    var repeatReg = /{{\s*repeat\((\d+),?\s*(\d*)?\)\s*}}/,
        resultArray = [];

    for(var i = 0; i < arr.length; i++) {
      var item = arr[i];

      // if item is string and has repeat method, repeat the next item to result array
      if(typeof  item === 'string' && repeatReg.test(item)) {
        var nextItem = arr[++i],
            min = parseInt(RegExp.$1) || 0,
            max = parseInt(RegExp.$2),
            length;

        length = isNaN(max) ? min : _.random(min, max);

        if(nextItem) {
          for(var j = 0; j < length; j++) {
            // parse the next item and pass the index value
            resultArray.push(generate(_.clone(nextItem), j));
          }
        }

      } else {
        resultArray.push(generate(item));
      }
    }

    return resultArray;
  },

  // parse function
  '_function': function(func, index) {
    return func.call(this, faker, index);
  },

  // get parser according to the data type
  getParser: function(template) {
    if(_.isArray(template)) return this._array;

    return this['_' + (typeof template)];
  }

};

/**
 * generate
 * @param template - json scheme
 * @param [index] - array index
 * @returns {*}
 */
function generate(template, index) {

  var data,
      parser = parsers.getParser(template);

  if(typeof parser === 'function') {
    data = parser.call(this, template, index);
  } else {
    data = template;
  }
  return data;
}

/**
 * save as json file
 * @param template - json scheme
 * @param path - path to save file
 */
function save(template, distpath) {
  var data = generate(template);
  var dir = path.dirname(distpath);

  mkdirp(dir, function(err) {
    if(err) {
      console.log(err.message);
      return;
    }

    fs.writeFile(distpath, JSON.stringify(data, null, 2), function(err) {
      if(err) {
        console.log(err.message);
        return;
      }
    });

  });

}

module.exports = {
  faker: faker,
  generate: generate,
  save: save
};
