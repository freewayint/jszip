'use strict';
var USE_TYPEDARRAY = (typeof Uint8Array !== 'undefined') && (typeof Uint16Array !== 'undefined') && (typeof Uint32Array !== 'undefined');

var zstd = require("node-zstd2");
var utils = require("./utils");
var GenericWorker = require("./stream/GenericWorker");

var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";

exports.magic = "\x09\x00";

function ZstdWorker(action, options) {
    GenericWorker.call(this, "ZstdWorker/" + action);

    this._zstd = null;
    this._zstdAction = action;
    this._zstdOptions = options;
    // the `meta` object from the last chunk received
    // this allow this worker to pass around metadata
    this.meta = {};
}

utils.inherits(ZstdWorker, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
ZstdWorker.prototype.processChunk = function (chunk) {
    this.meta = chunk.meta;
    if (this._zstd === null) {
        this._createZstd();
    }
    this._zstd.push(utils.transformTo(ARRAY_TYPE, chunk.data), false);
};

/**
 * @see GenericWorker.flush
 */
ZstdWorker.prototype.flush = function () {
    GenericWorker.prototype.flush.call(this);
    if (this._zstd === null) {
        this._createZstd();
    }
    this._zstd.push([], true);
};
/**
 * @see GenericWorker.cleanUp
 */
ZstdWorker.prototype.cleanUp = function () {
    GenericWorker.prototype.cleanUp.call(this);
    this._zstd = null;
};

/**
 * Create the _zstd object.
 * TODO: lazy-loading this object isn't the best solution but it's the
 * quickest. The best solution is to lazy-load the worker list. See also the
 * issue #446.
 */
ZstdWorker.prototype._createZstd = function () {
    this._zstd = new zstd[this._pakoAction]({
        raw: true,
        level: this._zstdOptions.level || -1 // default compression
    });
    var self = this;
    this._zstd.onData = function(data) {
        self.push({
            data : data,
            meta : self.meta
        });
    };
};

exports.compressWorker = function (compressionOptions) {
    return new ZstdWorker("ZstdCompress", compressionOptions);
};
exports.uncompressWorker = function () {
    return new ZstdWorker("ZstdUncompress", {});
};
