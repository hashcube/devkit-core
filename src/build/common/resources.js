var exec = require('child_process').exec;
var ff = require('ff');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var printf = require('printf');
var etags = require('etags');

var Resource = Class(function () {
  this.init = function (opts) {
    this.target = opts.target;
    this.copyFrom = opts.copyFrom;

    if ('contents' in opts) {
      this.contents = opts.contents;
    }
  }
});

exports.ResourceList = Class(function () {
  this.init = function (logger) {
    this._resources = [];
    this._logger = logger || console;
  }

  this.add = function (opts) {
    this._resources.push(new Resource(opts));
  }

  this.write = function (targetDirectory, appPath, cb) {
    new Writer(this._resources.slice(0), targetDirectory, appPath, this._logger)
      .write(cb);
  }

  this.getHashes = function (targetDirectory, appPath, cb) {
    var f = ff(function () {
      var hashes = {};
      f(hashes);

      this._resources.forEach(function (res) {
        var next = f.waitPlain();
        var targetPath = path.join(this._targetDirectory, res.target);
        etags.hash(targetPath, function (err, md5) {
          if (!err) {
            hashes[targetPath] = md5;
          }
          next();
        });
      });
    }).cb(cb);
  }

  this.writeSourceMap = function (targetDirectory, imageSourceMap, cb) {
    fs.writeFile(path.join(targetDirectory, 'resource_source_map.json'), JSON.stringify(merge(imageSourceMap, this.toSourceMap())), cb);
  }

  this.toSourceMap = function () {
    var res = {};
    this._resources.forEach(function (resource) {
      if (resource.target && resource.copyFrom) {
        res[resource.target] = resource.copyFrom;
      }
    });
    return res;
  }
});

var Writer = Class(function () {
  this.init = function (resources, targetDirectory, appPath, logger) {
    this._resources = resources;
    this._targetDirectory = targetDirectory;
    this._appPath = appPath;
    this._logger = logger;
  }

  this.write = function (cb) {
    this._onFinish = cb;
    this._writeNext();
  }

  this._writeNext = function () {
    var res = this._resources.shift();
    if (!res) {
      return this._onFinish();
    }

    var logger = this._logger;

    var cb = function (err) {
      if (err) {
        logger.error(err);
        this._onFinish(err);
      } else {
        logger.log('wrote', res.target);
        this._writeNext();
      }
    }.bind(this);

    var targetFile = path.join(this._targetDirectory, res.target);
    mkdirp(path.dirname(targetFile), function (err) {
      if (err) { return cb(err); }

      if ('contents' in res) {
        fs.writeFile(targetFile, res.contents, cb);
      } else if (res.copyFrom && res.copyFrom != targetFile) {
        var cmd = printf('cp -p "%(src)s" "%(dest)s"', {
          src: res.copyFrom,
          dest: targetFile
        });

        exec(cmd, {cwd: this._appPath}, function (err, stdout, stderr) {
          if (err && err.code != 1) {
            logger.log(JSON.stringify(code));
            cb(new Error('code ' + code + '\n' + stdout + '\n' + stderr));
          } else {
            cb();
          }
        });
      } else {
        cb();
      }
    });
  }
});
