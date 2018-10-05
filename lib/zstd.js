'use strict';
var zstd = require("node-zstd2");
var utils = require("./utils");
var GenericWorker = require("./stream/GenericWorker");

var ARRAY_TYPE = "uint8array";

exports.magic = "\x09\x00"; // using the different magic number

function ZstdWorker(action, options) {
    GenericWorker.call(this, "ZstdWorker/" + action);

    this._zstdAction = action;
    this._zstdOptions = {
		level: 9
	};
	
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
	
    if (this._zstdBuffer == null)
        this._zstdBuffer = new Uint8Array(0);
	
	var chunkbuff = utils.transformTo(ARRAY_TYPE, chunk.data);
	var merged = new Uint8Array(this._zstdBuffer.length + chunkbuff.length);
	merged.set(this._zstdBuffer);
	merged.set(chunkbuff, this._zstdBuffer.length);
	this._zstdBuffer = merged;
};

/**
 * @see GenericWorker.flush
 */
ZstdWorker.prototype.flush = function () {
    GenericWorker.prototype.flush.call(this);
	
    if (this._zstdBuffer != null) {
		var result;
		var buff = Buffer.from(this._zstdBuffer);
		
		if (this._zstdAction === 'ZstdCompress')
			result = zstd.compressSync(buff, this._zstdOptions);
		else
		if (this._zstdAction === 'ZstdUncompress')
			result = zstd.decompressSync(buff._zstdBuffer);
		
		this.push({
			data: result,
			meta: this.meta
		});
    }
};
/**
 * @see GenericWorker.cleanUp
 */
ZstdWorker.prototype.cleanUp = function () {
    GenericWorker.prototype.cleanUp.call(this);
    this._zstdBuffer = null;
};

exports.compressWorker = function (compressionOptions) {
    return new ZstdWorker("ZstdCompress", compressionOptions);
};
exports.uncompressWorker = function () {
    return new ZstdWorker("ZstdUncompress", {});
};
