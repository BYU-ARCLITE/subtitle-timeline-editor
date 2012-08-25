var Base,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Base = (function() {
  var fnTest;

  function Base() {}

  fnTest = /\b_super\b/;

  Base.extend = function(prop) {
    var Class, fn, key, keys, _ref, _super;
    Class = (function(_super) {

      __extends(Class, _super);

      function Class() {
        return Class.__super__.constructor.apply(this, arguments);
      }

      return Class;

    })(this);
    if (typeof prop === 'function') {
      keys = Object.keys(Class.prototype);
      prop.call(Class, Class);
      prop = {};
      _ref = Class.prototype;
      for (key in _ref) {
        fn = _ref[key];
        if (__indexOf.call(keys, key) < 0) {
          prop[key] = fn;
        }
      }
    }
    _super = Class.__super__;
    for (key in prop) {
      fn = prop[key];
      if (typeof fn === 'function' && fnTest.test(fn)) {
        (function(key, fn) {
          return Class.prototype[key] = function() {
            var ret, tmp;
            tmp = this._super;
            this._super = _super[key];
            ret = fn.apply(this, arguments);
            this._super = tmp;
            return ret;
          };
        })(key, fn);
      } else {
        Class.prototype[key] = fn;
      }
    }
    return Class;
  };

  return Base;

})();

var Buffer = (function() {
  var BlobBuilder, URL;

  function Buffer(data) {
    this.data = data;
    this.length = this.data.length;
  }

  Buffer.allocate = function(size) {
    return new Buffer(new Uint8Array(size));
  };

  Buffer.prototype.copy = function() {
    return new Buffer(new Uint8Array(this.data));
  };

  Buffer.prototype.slice = function(position, length) {
    if (position === 0 && length >= this.length) {
      return new Buffer(this.data);
    } else {
      return new Buffer(this.data.subarray(position, position + length));
    }
  };

  BlobBuilder = window.BlobBuilder || window.MozBlobBuilder || window.WebKitBlobBuilder;

  URL = window.URL || window.webkitURL || window.mozURL;

  Buffer.makeBlob = function(data) {
    var bb;
    try {
      return new Blob([data]);
    } catch (_error) {}
    if (BlobBuilder != null) {
      bb = new BlobBuilder;
      bb.append(data);
      return bb.getBlob();
    }
    return null;
  };

  Buffer.makeBlobURL = function(data) {
    return URL != null ? URL.createObjectURL(this.makeBlob(data)) : void 0;
  };

  Buffer.revokeBlobURL = function(url) {
    return URL != null ? URL.revokeObjectURL(url) : void 0;
  };

  Buffer.prototype.toBlob = function() {
    return Buffer.makeBlob(this.data.buffer);
  };

  Buffer.prototype.toBlobURL = function() {
    return Buffer.makeBlobURL(this.data.buffer);
  };

  return Buffer;

})();

var BufferList = (function() {

  function BufferList() {
    this.buffers = [];
    this.availableBytes = 0;
    this.availableBuffers = 0;
    this.first = null;
  }

  BufferList.prototype.copy = function() {
    var result;
    result = new BufferList;
    result.buffers = this.buffers.slice(0);
    result.first = result.buffers[0];
    result.availableBytes = this.availableBytes;
    result.availableBuffers = this.availableBuffers;
    return result;
  };

  BufferList.prototype.shift = function() {
    var result;
    result = this.buffers.shift();
    this.availableBytes -= result.length;
    this.availableBuffers -= 1;
    this.first = this.buffers[0];
    return result;
  };

  BufferList.prototype.push = function(buffer) {
    this.buffers.push(buffer);
    this.availableBytes += buffer.length;
    this.availableBuffers += 1;
    if (!this.first) {
      this.first = buffer;
    }
    return this;
  };

  BufferList.prototype.unshift = function(buffer) {
    this.buffers.unshift(buffer);
    this.availableBytes += buffer.length;
    this.availableBuffers += 1;
    this.first = buffer;
    return this;
  };

  return BufferList;

})();

var Stream = (function() {
  var buf, float32, float64, float64Fallback, float80, int16, int32, int8, nativeEndian, uint16, uint32, uint8;

  buf = new ArrayBuffer(16);
  uint8 = new Uint8Array(buf);
  int8 = new Int8Array(buf);
  uint16 = new Uint16Array(buf);
  int16 = new Int16Array(buf);
  uint32 = new Uint32Array(buf);
  int32 = new Int32Array(buf);
  float32 = new Float32Array(buf);

  if (typeof Float64Array !== "undefined" && Float64Array !== null) {
    float64 = new Float64Array(buf);
  }

  nativeEndian = new Uint16Array(new Uint8Array([0x12, 0x34]).buffer)[0] === 0x3412;

  function Stream(list) {
    this.list = list;
    this.localOffset = 0;
    this.offset = 0;
  }

  Stream.fromBuffer = function(buffer) {
    var list;
    list = new BufferList;
    list.push(buffer);
    return new Stream(list);
  };

  Stream.prototype.copy = function() {
    var result;
    result = new Stream(this.list.copy());
    result.localOffset = this.localOffset;
    result.offset = this.offset;
    return result;
  };

  Stream.prototype.available = function(bytes) {
    return bytes <= this.list.availableBytes - this.localOffset;
  };

  Stream.prototype.remainingBytes = function() {
    return this.list.availableBytes - this.localOffset;
  };

  Stream.prototype.advance = function(bytes) {
    this.localOffset += bytes;
    this.offset += bytes;
    while (this.list.first && (this.localOffset >= this.list.first.length)) {
      this.localOffset -= this.list.shift().length;
    }
    return this;
  };

  Stream.prototype.readUInt8 = function() {
    var a;
    a = this.list.first.data[this.localOffset];
    this.localOffset += 1;
    this.offset += 1;
    if (this.localOffset === this.list.first.length) {
      this.localOffset = 0;
      this.list.shift();
    }
    return a;
  };

  Stream.prototype.peekUInt8 = function(offset) {
    var buffer, list, _i, _len;
    if (offset == null) {
      offset = 0;
    }
    offset = this.localOffset + offset;
    list = this.list.buffers;
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      buffer = list[_i];
      if (buffer.length > offset) {
        return buffer.data[offset];
      }
      offset -= buffer.length;
    }
    return 0;
  };

  Stream.prototype.read = function(bytes, littleEndian) {
    var i, _i, _j, _ref;
    if (littleEndian == null) {
      littleEndian = false;
    }
    if (littleEndian === nativeEndian) {
      for (i = _i = 0; _i < bytes; i = _i += 1) {
        uint8[i] = this.readUInt8();
      }
    } else {
      for (i = _j = _ref = bytes - 1; _j >= 0; i = _j += -1) {
        uint8[i] = this.readUInt8();
      }
    }
  };

  Stream.prototype.peek = function(bytes, offset, littleEndian) {
    var i, _i, _j;
    if (littleEndian == null) {
      littleEndian = false;
    }
    if (littleEndian === nativeEndian) {
      for (i = _i = 0; _i < bytes; i = _i += 1) {
        uint8[i] = this.peekUInt8(offset + i);
      }
    } else {
      for (i = _j = 0; _j < bytes; i = _j += 1) {
        uint8[bytes - i - 1] = this.peekUInt8(offset + i);
      }
    }
  };

  Stream.prototype.readInt8 = function() {
    this.read(1);
    return int8[0];
  };

  Stream.prototype.peekInt8 = function(offset) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(1, offset);
    return int8[0];
  };

  Stream.prototype.readUInt16 = function(littleEndian) {
    this.read(2, littleEndian);
    return uint16[0];
  };

  Stream.prototype.peekUInt16 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(2, offset, littleEndian);
    return uint16[0];
  };

  Stream.prototype.readInt16 = function(littleEndian) {
    this.read(2, littleEndian);
    return int16[0];
  };

  Stream.prototype.peekInt16 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(2, offset, littleEndian);
    return int16[0];
  };

  Stream.prototype.readUInt24 = function(littleEndian) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readUInt8() << 16);
    } else {
      return (this.readUInt16() << 8) + this.readUInt8();
    }
  };

  Stream.prototype.peekUInt24 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekUInt8(offset + 2) << 16);
    } else {
      return (this.peekUInt16(offset) << 8) + this.peekUInt8(offset + 2);
    }
  };

  Stream.prototype.readInt24 = function(littleEndian) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readInt8() << 16);
    } else {
      return (this.readInt16() << 8) + this.readUInt8();
    }
  };

  Stream.prototype.peekInt24 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekInt8(offset + 2) << 16);
    } else {
      return (this.peekInt16(offset) << 8) + this.peekUInt8(offset + 2);
    }
  };

  Stream.prototype.readUInt32 = function(littleEndian) {
    this.read(4, littleEndian);
    return uint32[0];
  };

  Stream.prototype.peekUInt32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return uint32[0];
  };

  Stream.prototype.readInt32 = function(littleEndian) {
    this.read(4, littleEndian);
    return int32[0];
  };

  Stream.prototype.peekInt32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return int32[0];
  };

  Stream.prototype.readFloat32 = function(littleEndian) {
    this.read(4, littleEndian);
    return float32[0];
  };

  Stream.prototype.peekFloat32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return float32[0];
  };

  Stream.prototype.readFloat64 = function(littleEndian) {
    this.read(8, littleEndian);
    if (float64) {
      return float64[0];
    } else {
      return float64Fallback();
    }
  };

  float64Fallback = function() {
    var exp, frac, high, low, out, sign;
    low = uint32[0], high = uint32[1];
    if (!high || high === 0x80000000) {
      return 0.0;
    }
    sign = 1 - (high >>> 31) * 2;
    exp = (high >>> 20) & 0x7ff;
    frac = high & 0xfffff;
    if (exp === 0x7ff) {
      if (frac) {
        return NaN;
      }
      return sign * Infinity;
    }
    exp -= 1023;
    out = (frac | 0x100000) * Math.pow(2, exp - 20);
    out += low * Math.pow(2, exp - 52);
    return sign * out;
  };

  Stream.prototype.peekFloat64 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(8, offset, littleEndian);
    if (float64) {
      return float64[0];
    } else {
      return float64Fallback();
    }
  };

  Stream.prototype.readFloat80 = function(littleEndian) {
    this.read(10, littleEndian);
    return float80();
  };

  float80 = function() {
    var a0, a1, exp, high, low, out, sign;
    high = uint32[0], low = uint32[1];
    a0 = uint8[9];
    a1 = uint8[8];
    sign = 1 - (a0 >>> 7) * 2;
    exp = ((a0 & 0x7F) << 8) | a1;
    if (exp === 0 && low === 0 && high === 0) {
      return 0;
    }
    if (exp === 0x7fff) {
      if (low === 0 && high === 0) {
        return sign * Infinity;
      }
      return NaN;
    }
    exp -= 16383;
    out = low * Math.pow(2, exp - 31);
    out += high * Math.pow(2, exp - 63);
    return sign * out;
  };

  Stream.prototype.peekFloat80 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(10, offset, littleEndian);
    return float80();
  };

  Stream.prototype.readString = function(length) {
    var i, result, _i;
    result = [];
    for (i = _i = 0; _i < length; i = _i += 1) {
      result.push(String.fromCharCode(this.readUInt8()));
    }
    return result.join('');
  };

  Stream.prototype.peekString = function(offset, length) {
    var i, result, _i;
    result = [];
    for (i = _i = 0; _i < length; i = _i += 1) {
      result.push(String.fromCharCode(this.peekUInt8(offset + i)));
    }
    return result.join('');
  };

  Stream.prototype.readUTF8 = function(length) {
    return decodeURIComponent(escape(this.readString(length)));
  };

  Stream.prototype.peekUTF8 = function(offset, length) {
    return decodeURIComponent(escape(this.peekString(offset, length)));
  };

  Stream.prototype.readBuffer = function(length) {
    var i, result, to, _i;
    result = Buffer.allocate(length);
    to = result.data;
    for (i = _i = 0; _i < length; i = _i += 1) {
      to[i] = this.readUInt8();
    }
    return result;
  };

  Stream.prototype.peekBuffer = function(offset, length) {
    var i, result, to, _i;
    if (offset == null) {
      offset = 0;
    }
    result = Buffer.allocate(length);
    to = result.data;
    for (i = _i = 0; _i < length; i = _i += 1) {
      to[i] = this.peekUInt8(offset + i);
    }
    return result;
  };

  Stream.prototype.readSingleBuffer = function(length) {
    var result;
    result = this.list.first.slice(this.localOffset, length);
    this.advance(result.length);
    return result;
  };

  Stream.prototype.peekSingleBuffer = function(length) {
    var result;
    result = this.list.first.slice(this.localOffset, length);
    return result;
  };

  return Stream;

})();

var Bitstream = (function() {

  function Bitstream(stream) {
    this.stream = stream;
    this.bitPosition = 0;
  }

  Bitstream.prototype.copy = function() {
    var result;
    result = new Bitstream(this.stream.copy());
    result.bitPosition = this.bitPosition;
    return result;
  };

  Bitstream.prototype.offset = function() {
    return 8 * this.stream.offset + this.bitPosition;
  };

  Bitstream.prototype.available = function(bits) {
    return this.stream.available((bits + 8 - this.bitPosition) / 8);
  };

  Bitstream.prototype.advance = function(bits) {
    this.bitPosition += bits;
    this.stream.advance(this.bitPosition >> 3);
    this.bitPosition = this.bitPosition & 7;
    return this;
  };

  Bitstream.prototype.align = function() {
    if (this.bitPosition !== 0) {
      this.bitPosition = 0;
      this.stream.advance(1);
    }
    return this;
  };

  Bitstream.prototype.readBig = function(bits) {
    var val;
    if (bits === 0) {
      return 0;
    }
    val = this.peekBig(bits);
    this.advance(bits);
    return val;
  };

  Bitstream.prototype.peekBig = function(bits) {
    var a, a0, a1, a2, a3, a4;
    if (bits === 0) {
      return 0;
    }
    a0 = this.stream.peekUInt8(0) * 0x0100000000;
    a1 = this.stream.peekUInt8(1) * 0x0001000000;
    a2 = this.stream.peekUInt8(2) * 0x0000010000;
    a3 = this.stream.peekUInt8(3) * 0x0000000100;
    a4 = this.stream.peekUInt8(4) * 0x0000000001;
    a = a0 + a1 + a2 + a3 + a4;
    a = a % Math.pow(2, 40 - this.bitPosition);
    a = a / Math.pow(2, 40 - this.bitPosition - bits);
    return a << 0;
  };

  Bitstream.prototype.read = function(bits) {
    var a;
    if (bits === 0) {
      return 0;
    }
    a = this.stream.peekUInt32(0);
    a = (a << this.bitPosition) >>> (32 - bits);
    this.advance(bits);
    return a;
  };

  Bitstream.prototype.readSigned = function(bits) {
    var a;
    if (bits === 0) {
      return 0;
    }
    a = this.stream.peekUInt32(0);
    a = (a << this.bitPosition) >> (32 - bits);
    this.advance(bits);
    return a;
  };

  Bitstream.prototype.peek = function(bits) {
    var a;
    if (bits === 0) {
      return 0;
    }
    a = this.stream.peekUInt32(0);
    a = (a << this.bitPosition) >>> (32 - bits);
    return a;
  };

  Bitstream.prototype.readSmall = function(bits) {
    var a;
    if (bits === 0) {
      return 0;
    }
    a = this.stream.peekUInt16(0);
    a = ((a << this.bitPosition) & 0xFFFF) >>> (16 - bits);
    this.advance(bits);
    return a;
  };

  Bitstream.prototype.peekSmall = function(bits) {
    var a;
    if (bits === 0) {
      return 0;
    }
    a = this.stream.peekUInt16(0);
    a = ((a << this.bitPosition) & 0xFFFF) >>> (16 - bits);
    return a;
  };

  Bitstream.prototype.readOne = function() {
    var a;
    a = this.stream.peekUInt8(0);
    a = ((a << this.bitPosition) & 0xFF) >>> 7;
    this.advance(1);
    return a;
  };

  Bitstream.prototype.peekOne = function() {
    var a;
    a = this.stream.peekUInt8(0);
    a = ((a << this.bitPosition) & 0xFF) >>> 7;
    return a;
  };

  return Bitstream;

})();



var EventEmitter,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

EventEmitter = (function(_super) {

  __extends(EventEmitter, _super);

  function EventEmitter() {
    return EventEmitter.__super__.constructor.apply(this, arguments);
  }

  EventEmitter.prototype.on = function(event, fn) {
    var _base, _ref, _ref1;
    if ((_ref = this.events) == null) {
      this.events = {};
    }
    if ((_ref1 = (_base = this.events)[event]) == null) {
      _base[event] = [];
    }
    return this.events[event].push(fn);
  };

  EventEmitter.prototype.off = function(event, fn) {
    var index, _ref;
    if (!((_ref = this.events) != null ? _ref[event] : void 0)) {
      return;
    }
    index = this.events[event].indexOf(fn);
    if (~index) {
      return this.events[event].splice(index, 1);
    }
  };

  EventEmitter.prototype.once = function(event, fn) {
    var cb,
      _this = this;
    return this.on(event, cb = function() {
      _this.off(event, cb);
      return fn.apply(_this, arguments);
    });
  };

  EventEmitter.prototype.emit = function() {
    var args, event, fn, _i, _len, _ref, _ref1;
    event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (!((_ref = this.events) != null ? _ref[event] : void 0)) {
      return;
    }
    _ref1 = this.events[event];
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      fn = _ref1[_i];
      fn.apply(this, args);
    }
  };

  return EventEmitter;

})(Base);



var Demuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Demuxer = (function(_super) {
  var formats;

  __extends(Demuxer, _super);

  Demuxer.probe = function(buffer) {
    return false;
  };

  function Demuxer(source, chunk) {
    var list, received,
      _this = this;
    list = new BufferList;
    list.push(chunk);
    this.stream = new Stream(list);
    received = false;
    source.on('data', function(chunk) {
      received = true;
      list.push(chunk);
      return _this.readChunk(chunk);
    });
    source.on('error', function(err) {
      return _this.emit('error', err);
    });
    source.on('end', function() {
      if (!received) {
        _this.readChunk(chunk);
      }
      return _this.emit('end');
    });
    this.init();
  }

  Demuxer.prototype.init = function() {};

  Demuxer.prototype.readChunk = function(chunk) {};

  Demuxer.prototype.seek = function(timestamp) {
    return 0;
  };

  formats = [];

  Demuxer.register = function(demuxer) {
    return formats.push(demuxer);
  };

  Demuxer.find = function(buffer) {
    var format, stream, _i, _len;
    stream = Stream.fromBuffer(buffer);
    for (_i = 0, _len = formats.length; _i < _len; _i++) {
      format = formats[_i];
      if (format.probe(stream)) {
        return format;
      }
    }
    return null;
  };

  return Demuxer;

})(EventEmitter);



var Decoder,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Decoder = (function(_super) {
  var codecs;

  __extends(Decoder, _super);

  function Decoder(demuxer, format) {
    var list,
      _this = this;
    this.format = format;
    list = new BufferList;
    this.stream = new Stream(list);
    this.bitstream = new Bitstream(this.stream);
    this.receivedFinalBuffer = false;
    demuxer.on('cookie', function(cookie) {
      return _this.setCookie(cookie);
    });
    demuxer.on('data', function(chunk, final) {
      _this.receivedFinalBuffer = !!final;
      list.push(chunk);
      return _this.emit('available');
    });
    this.init();
  }

  Decoder.prototype.init = function() {};

  Decoder.prototype.setCookie = function(cookie) {};

  Decoder.prototype.readChunk = function() {};

  Decoder.prototype.seek = function(position) {
    return 'Not Implemented.';
  };

  codecs = {};

  Decoder.register = function(id, decoder) {
    return codecs[id] = decoder;
  };

  Decoder.find = function(id) {
    return codecs[id] || null;
  };

  return Decoder;

})(EventEmitter);



var Queue,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Queue = (function(_super) {

  __extends(Queue, _super);

  function Queue(decoder) {
    this.decoder = decoder;
    this.write = __bind(this.write, this);

    this.readyMark = 64;
    this.finished = false;
    this.buffering = true;
    this.buffers = [];
    this.decoder.on('data', this.write);
    this.decoder.readChunk();
  }

  Queue.prototype.write = function(buffer) {
    if (buffer) {
      this.buffers.push(buffer);
    }
    if (this.buffering) {
      if (this.buffers.length >= this.readyMark || this.decoder.receivedFinalBuffer) {
        this.buffering = false;
        return this.emit('ready');
      } else {
        return this.decoder.readChunk();
      }
    }
  };

  Queue.prototype.read = function() {
    if (this.buffers.length === 0) {
      return null;
    }
    this.decoder.readChunk();
    return this.buffers.shift();
  };

  return Queue;

})(EventEmitter);


var Asset,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Asset = (function(_super) {

  __extends(Asset, _super);

  window.Asset = Asset;

  function Asset(source) {
    var _this = this;
    this.source = source;
    this.findDecoder = __bind(this.findDecoder, this);

    this.probe = __bind(this.probe, this);

    this.buffered = 0;
    this.duration = null;
    this.format = null;
    this.metadata = null;
    this.active = false;
    this.demuxer = null;
    this.decoder = null;
    this.source.once('data', this.probe);
    this.source.on('error', function(err) {
      _this.emit('error', err);
      return _this.stop();
    });
    this.source.on('progress', function(buffered) {
      _this.buffered = buffered;
      return _this.emit('buffer', _this.buffered);
    });
  }

  Asset.fromURL = function(url) {
    var source;
    source = new HTTPSource(url);
    return new Asset(source);
  };

  Asset.fromFile = function(file) {
    var source;
    source = new FileSource(file);
    return new Asset(source);
  };

  Asset.prototype.start = function() {
    if (this.active) {
      return;
    }
    this.active = true;
    return this.source.start();
  };

  Asset.prototype.stop = function() {
    if (!this.active) {
      return;
    }
    this.active = false;
    return this.source.pause();
  };

  Asset.prototype.get = function(event, callback) {
    var _this = this;
    if (event !== 'format' && event !== 'duration' && event !== 'metadata') {
      return;
    }
    if (this[event] != null) {
      return callback(this[event]);
    } else {
      this.once(event, function(value) {
        _this.stop();
        return callback(value);
      });
      return this.start();
    }
  };

  Asset.prototype.probe = function(chunk) {
    var demuxer,
      _this = this;
    if (!this.active) {
      return;
    }
    demuxer = Demuxer.find(chunk);
    if (!demuxer) {
      return this.emit('error', 'A demuxer for this container was not found.');
    }
    this.demuxer = new demuxer(this.source, chunk);
    this.demuxer.on('format', this.findDecoder);
    this.demuxer.on('duration', function(duration) {
      _this.duration = duration;
      return _this.emit('duration', _this.duration);
    });
    this.demuxer.on('metadata', function(metadata) {
      _this.metadata = metadata;
      return _this.emit('metadata', _this.metadata);
    });
    return this.demuxer.on('error', function(err) {
      _this.emit('error', err);
      return _this.stop();
    });
  };

  Asset.prototype.findDecoder = function(format) {
    var decoder,
      _this = this;
    this.format = format;
    if (!this.active) {
      return;
    }
    this.emit('format', this.format);
    console.log(this.format);
    decoder = Decoder.find(this.format.formatID);
    if (!decoder) {
      return this.emit('error', "A decoder for " + this.format.formatID + " was not found.");
    }
    this.decoder = new decoder(this.demuxer, this.format);
    this.decoder.on('data', function(buffer) {
      return _this.emit('data', buffer);
    });
    this.decoder.on('error', function(err) {
      _this.emit('error', err);
      return _this.stop();
    });
    return this.emit('decodeStart');
  };

  return Asset;

})(EventEmitter);

var Reader,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Reader = (function(_super) {

  __extends(Reader, _super);

  window.Reader = Reader;

  function Reader(asset) {
    var _this = this;
    this.asset = asset;

	this.playing = false;
    this.buffered = 0;
    this.duration = 0;
    this.metadata = {};
    this.asset.on('buffer', function(buffered) {
      _this.buffered = buffered;
      return _this.emit('buffer', _this.buffered);
    });
    this.asset.on('decodeStart', function() {
      _this.queue = new Queue(_this.asset.decoder);
      return _this.queue.once('ready', startPlaying.bind(_this));
    });
    this.asset.on('format', function(format) {
      _this.format = format;
      return _this.emit('format', _this.format);
    });
    this.asset.on('metadata', function(metadata) {
      _this.metadata = metadata;
      return _this.emit('metadata', _this.metadata);
    });
    this.asset.on('duration', function(duration) {
      _this.duration = duration;
      return _this.emit('duration', _this.duration);
    });
    this.asset.on('error', function(error) {
      return _this.emit('error', error);
    });
  }

  Reader.fromURL = function(url) {
    var asset;
    asset = Asset.fromURL(url);
    return new Reader(asset);
  };

  Reader.fromFile = function(file) {
    var asset;
    asset = Asset.fromFile(file);
    return new Reader(asset);
  };

  Reader.prototype.start = function(){
    this.asset.start();
  }
  
  function startPlaying() {
    var decoder, div, format, frame, frameOffset, _ref,
      _this = this;
    frame = this.queue.read();
    frameOffset = 0;
    _ref = this.asset;
	format = _ref.format;
	decoder = _ref.decoder;
    div = decoder.floatingPoint ? 1 : Math.pow(2, format.bitsPerChannel - 1);
    this.get = function(buffer) {
      var bufferOffset, i, max, _i, _j, _len, _ref1;
      bufferOffset = 0;
      while (frame && bufferOffset < buffer.length) {
        max = Math.min(frame.length - frameOffset, buffer.length - bufferOffset);
        for (i = _i = 0; _i < max; i = _i += 1) {
          buffer[bufferOffset++] = frame[frameOffset++] / div;
        }
        if (frameOffset === frame.length) {
          frame = _this.queue.read();
          frameOffset = 0;
        }
      }
      if (!frame) {
        if (decoder.receivedFinalBuffer) {
          return "pause";
        } else {
		  return "end";
        }
      }
	  return "filled";
    };
    return this.emit('ready');
  };

  return Reader;

})(EventEmitter);


var HTTPSource,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

HTTPSource = (function(_super) {

  __extends(HTTPSource, _super);

  function HTTPSource(url) {
    this.url = url;
    this.chunkSize = 1 << 20;
    this.inflight = false;
    this.reset();
  }

  HTTPSource.prototype.start = function() {
    var _this = this;
    this.inflight = true;
    this.xhr = new XMLHttpRequest();
    this.xhr.onload = function(event) {
      _this.length = parseInt(_this.xhr.getResponseHeader("Content-Length"));
      _this.inflight = false;
      return _this.loop();
    };
    this.xhr.onerror = function(err) {
      _this.pause();
      return _this.emit('error', err);
    };
    this.xhr.onabort = function(event) {
      console.log("HTTP Aborted: Paused?");
      return _this.inflight = false;
    };
    this.xhr.open("HEAD", this.url, true);
    return this.xhr.send(null);
  };

  HTTPSource.prototype.loop = function() {
    var endPos,
      _this = this;
    if (this.inflight || !this.length) {
      return this.emit('error', 'Something is wrong in HTTPSource.loop');
    }
    if (this.offset === this.length) {
      this.inflight = false;
      this.emit('end');
      return;
    }
    this.inflight = true;
    this.xhr = new XMLHttpRequest();
    this.xhr.onprogress = function(event) {
      return _this.emit('progress', (_this.offset + event.loaded) / _this.length * 100);
    };
    this.xhr.onload = function(event) {
      var buf, buffer, i, txt, _i, _ref;
      if (_this.xhr.response) {
        buf = new Uint8Array(_this.xhr.response);
      } else {
        txt = _this.xhr.responseText;
        buf = new Uint8Array(txt.length);
        for (i = _i = 0, _ref = txt.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          buf[i] = txt.charCodeAt(i) & 0xff;
        }
      }
      buffer = new Buffer(buf);
      _this.offset += buffer.length;
      _this.emit('data', buffer);
      if (_this.offset === _this.length) {
        _this.emit('end');
      }
      _this.emit('progress', _this.offset / _this.length * 100);
      _this.inflight = false;
      return _this.loop();
    };
    this.xhr.onerror = function(err) {
      _this.emit('error', err);
      return _this.pause();
    };
    this.xhr.onabort = function(event) {
      return _this.inflight = false;
    };
    this.xhr.open("GET", this.url, true);
    this.xhr.responseType = "arraybuffer";
    endPos = Math.min(this.offset + this.chunkSize, this.length);
    this.xhr.setRequestHeader("Range", "bytes=" + this.offset + "-" + endPos);
    this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
    return this.xhr.send(null);
  };

  HTTPSource.prototype.pause = function() {
    var _ref;
    this.inflight = false;
    return (_ref = this.xhr) != null ? _ref.abort() : void 0;
  };

  HTTPSource.prototype.reset = function() {
    this.pause();
    return this.offset = 0;
  };

  return HTTPSource;

})(EventEmitter);

var FileSource,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

FileSource = (function(_super) {

  __extends(FileSource, _super);

  function FileSource(file) {
    this.file = file;
    if (!window.FileReader) {
      return this.emit('error', 'This browser does not have FileReader support.');
    }
    this.offset = 0;
    this.length = this.file.size;
    this.chunkSize = 1 << 20;
  }

  FileSource.prototype.start = function() {
    var _this = this;
    this.reader = new FileReader;
    this.reader.onload = function(e) {
      var buf;
      buf = new Buffer(new Uint8Array(e.target.result));
      _this.offset += buf.length;
      _this.emit('data', buf);
      _this.emit('progress', _this.offset / _this.length * 100);
      if (_this.offset < _this.length) {
        return _this.loop();
      }
    };
    this.reader.onloadend = function() {
      if (_this.offset === _this.length) {
        _this.emit('end');
        return _this.reader = null;
      }
    };
    this.reader.onerror = function(e) {
      return _this.emit('error', e);
    };
    this.reader.onprogress = function(e) {
      return _this.emit('progress', (_this.offset + e.loaded) / _this.length * 100);
    };
    return this.loop();
  };

  FileSource.prototype.loop = function() {
    var blob, endPos, slice;
    this.file[slice = 'slice'] || this.file[slice = 'webkitSlice'] || this.file[slice = 'mozSlice'];
    endPos = Math.min(this.offset + this.chunkSize, this.length);
    blob = this.file[slice](this.offset, endPos);
    return this.reader.readAsArrayBuffer(blob);
  };

  FileSource.prototype.pause = function() {
    var _ref;
    return (_ref = this.reader) != null ? _ref.abort() : void 0;
  };

  FileSource.prototype.reset = function() {
    this.pause();
    return this.offset = 0;
  };

  return FileSource;

})(EventEmitter);

var M4ADemuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

M4ADemuxer = (function(_super) {
  var genres, metafields, readDescr;

  __extends(M4ADemuxer, _super);

  function M4ADemuxer() {
    return M4ADemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(M4ADemuxer);

  M4ADemuxer.probe = function(buffer) {
    return buffer.peekString(8, 4) === 'M4A ';
  };

  metafields = {
    '©alb': 'Album',
    '©arg': 'Arranger',
    '©art': 'Artist',
    '©ART': 'Album Artist',
    'catg': 'Category',
    '©com': 'Composer',
    'covr': 'Cover Art',
    'cpil': 'Compilation',
    '©cpy': 'Copyright',
    'cprt': 'Copyright',
    'desc': 'Description',
    'disk': 'Disk Number',
    '©gen': 'Genre',
    'gnre': 'Genre',
    '©grp': 'Grouping',
    '©isr': 'ISRC Code',
    'keyw': 'Keyword',
    '©lab': 'Record Label',
    '©lyr': 'Lyrics',
    '©nam': 'Title',
    'pcst': 'Podcast',
    'pgap': 'Gapless',
    '©phg': 'Recording Copyright',
    '©prd': 'Producer',
    '©prf': 'Performers',
    'purl': 'Podcast URL',
    'rtng': 'Rating',
    '©swf': 'Songwriter',
    'tmpo': 'Tempo',
    '©too': 'Encoder',
    'trkn': 'Track Number',
    '©wrt': 'Composer'
  };

  genres = ["Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space", "Meditative", "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native American", "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes", "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock", "Folk", "Folk/Rock", "National Folk", "Swing", "Fast Fusion", "Bebob", "Latin", "Revival", "Celtic", "Bluegrass", "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock", "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour", "Speech", "Chanson", "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove", "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore", "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock", "Drum Solo", "A Capella", "Euro-House", "Dance Hall"];

  M4ADemuxer.prototype.readChunk = function() {
    var buffer, diff, duration, entryCount, field, i, numEntries, pos, rating, sampleRate, _i, _ref;
    while (this.stream.available(1)) {
      if (!this.readHeaders && this.stream.available(8)) {
        this.len = this.stream.readUInt32() - 8;
        this.type = this.stream.readString(4);
        if (this.len === 0) {
          continue;
        }
        this.readHeaders = true;
      }
      if (this.type in metafields) {
        this.metafield = this.type;
        this.readHeaders = false;
        continue;
      }
      switch (this.type) {
        case 'ftyp':
          if (!this.stream.available(this.len)) {
            return;
          }
          if (this.stream.readString(4) !== 'M4A ') {
            return this.emit('error', 'Not a valid M4A file.');
          }
          this.stream.advance(this.len - 4);
          break;
        case 'moov':
        case 'trak':
        case 'mdia':
        case 'minf':
        case 'stbl':
        case 'udta':
        case 'ilst':
          break;
        case 'stco':
          this.stream.advance(4);
          entryCount = this.stream.readUInt32();
          this.chunkOffsets = [];
          for (i = _i = 0; 0 <= entryCount ? _i < entryCount : _i > entryCount; i = 0 <= entryCount ? ++_i : --_i) {
            this.chunkOffsets[i] = this.stream.readUInt32();
          }
          break;
        case 'meta':
          this.metadata = {};
          this.metaMaxPos = this.stream.offset + this.len;
          this.stream.advance(4);
          break;
        case 'data':
          if (!this.stream.available(this.len)) {
            return;
          }
          field = metafields[this.metafield];
          switch (this.metafield) {
            case 'disk':
            case 'trkn':
              pos = this.stream.offset;
              this.stream.advance(10);
              this.metadata[field] = this.stream.readUInt16() + ' of ' + this.stream.readUInt16();
              this.stream.advance(this.len - (this.stream.offset - pos));
              break;
            case 'cpil':
            case 'pgap':
            case 'pcst':
              this.stream.advance(8);
              this.metadata[field] = this.stream.readUInt8() === 1;
              break;
            case 'gnre':
              this.stream.advance(8);
              this.metadata[field] = genres[this.stream.readUInt16() - 1];
              break;
            case 'rtng':
              this.stream.advance(8);
              rating = this.stream.readUInt8();
              this.metadata[field] = rating === 2 ? 'Clean' : rating !== 0 ? 'Explicit' : 'None';
              break;
            case 'tmpo':
              this.stream.advance(8);
              this.metadata[field] = this.stream.readUInt16();
              break;
            case 'covr':
              this.stream.advance(8);
              this.metadata[field] = this.stream.readBuffer(this.len - 8);
              break;
            default:
              this.metadata[field] = this.stream.readUTF8(this.len);
          }
          break;
        case 'mdhd':
          if (!this.stream.available(this.len)) {
            return;
          }
          this.stream.advance(4);
          this.stream.advance(8);
          sampleRate = this.stream.readUInt32();
          duration = this.stream.readUInt32();
          this.emit('duration', duration / sampleRate * 1000 | 0);
          this.stream.advance(4);
          break;
        case 'stsd':
          if (!this.stream.available(this.len)) {
            return;
          }
          this.stream.advance(4);
          numEntries = this.stream.readUInt32();
          if (numEntries !== 1) {
            return this.emit('error', "Only expecting one entry in sample description atom!");
          }
          this.stream.advance(4);
          this.format = {};
          this.format.formatID = this.stream.readString(4);
          this.stream.advance(6);
          if (this.stream.readUInt16() !== 1) {
            return this.emit('error', 'Unknown version in stsd atom.');
          }
          this.stream.advance(6);
          this.stream.advance(2);
          this.format.channelsPerFrame = this.stream.readUInt16();
          this.format.bitsPerChannel = this.stream.readUInt16();
          this.stream.advance(4);
          this.format.sampleRate = this.stream.readUInt16();
          this.stream.advance(2);
          this.emit('format', this.format);
          break;
        case 'alac':
          this.stream.advance(4);
          this.emit('cookie', this.stream.readBuffer(this.len - 4));
          this.sentCookie = true;
          if (this.dataSections) {
            this.sendDataSections();
          }
          break;
        case 'esds':
          this.readEsds();
          this.sentCookie = true;
          if (this.dataSections) {
            this.sendDataSections();
          }
          break;
        case 'mdat':
          if (this.chunkOffsets && this.stream.offset < this.chunkOffsets[0]) {
            diff = this.chunkOffsets[0] - this.stream.offset;
            this.stream.advance(diff);
            this.len -= diff;
          }
          buffer = this.stream.readSingleBuffer(this.len);
          this.len -= buffer.length;
          this.readHeaders = this.len > 0;
          if (this.sentCookie) {
            this.emit('data', buffer, this.len === 0);
          } else {
            if ((_ref = this.dataSections) == null) {
              this.dataSections = [];
            }
            this.dataSections.push(buffer);
          }
          break;
        default:
          if (!this.stream.available(this.len)) {
            return;
          }
          this.stream.advance(this.len);
      }
      if (this.stream.offset === this.metaMaxPos) {
        this.emit('metadata', this.metadata);
      }
      if (this.type !== 'mdat') {
        this.readHeaders = false;
      }
    }
  };

  M4ADemuxer.prototype.sendDataSections = function() {
    var interval,
      _this = this;
    return interval = setInterval(function() {
      _this.emit('data', _this.dataSections.shift(), _this.dataSections.length === 0);
      if (_this.dataSections.length === 0) {
        return clearInterval(interval);
      }
    }, 100);
  };

  M4ADemuxer.readDescrLen = function(stream) {
    var c, count, len;
    len = 0;
    count = 4;
    while (count--) {
      c = stream.readUInt8();
      len = (len << 7) | (c & 0x7f);
      if (!(c & 0x80)) {
        break;
      }
    }
    return len;
  };

  readDescr = function(stream) {
    var tag;
    tag = stream.readUInt8();
    return [tag, M4ADemuxer.readDescrLen(stream)];
  };

  M4ADemuxer.prototype.readEsds = function() {
    var codec_id, extra, flags, len, startPos, tag, _ref, _ref1, _ref2;
    startPos = this.stream.offset;
    this.stream.advance(4);
    _ref = readDescr(this.stream), tag = _ref[0], len = _ref[1];
    if (tag === 0x03) {
      this.stream.advance(2);
      flags = this.stream.readUInt8();
      if (flags & 0x80) {
        this.stream.advance(2);
      }
      if (flags & 0x40) {
        this.stream.advance(this.stream.readUInt8());
      }
      if (flags & 0x20) {
        this.stream.advance(2);
      }
    } else {
      this.stream.advance(2);
    }
    _ref1 = readDescr(this.stream), tag = _ref1[0], len = _ref1[1];
    if (tag === 0x04) {
      codec_id = this.stream.readUInt8();
      this.stream.advance(1);
      this.stream.advance(3);
      this.stream.advance(4);
      this.stream.advance(4);
      _ref2 = readDescr(this.stream), tag = _ref2[0], len = _ref2[1];
      if (tag === 0x05) {
        this.emit('cookie', this.stream.readBuffer(len));
      }
    }
    extra = this.len - this.stream.offset + startPos;
    return this.stream.advance(extra);
  };

  return M4ADemuxer;

})(Demuxer);