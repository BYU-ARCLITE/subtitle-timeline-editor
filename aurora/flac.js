/*
 * FLAC.js - Free Lossless Audio Codec decoder in JavaScript
 * By Devon Govett and Jens Nockert of Official.fm Labs
 *
 * FLAC.js is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * FLAC.js is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 */

FLACDemuxer = Demuxer.extend(function() {
    Demuxer.register(this);
    
    this.probe = function(buffer) {
        return buffer.peekString(0, 4) === 'fLaC';
    }
    
    const STREAMINFO = 0,
          PADDING = 1,
          APPLICATION = 2,
          SEEKTABLE = 3,
          VORBIS_COMMENT = 4,
          CUESHEET = 5,
          PICTURE = 6,
          INVALID = 127,
          STREAMINFO_SIZE = 34;
    
    this.prototype.readChunk = function() {
        var stream = this.stream;
        
        if (!this.readHeader && stream.available(4)) {
            if (stream.readString(4) !== 'fLaC')
                return this.emit('error', 'Invalid FLAC file.');
                
            this.readHeader = true;
        }
        
        while (stream.available(1) && !this.last) {                     
            if (!this.readBlockHeaders) {
                var tmp = stream.readUInt8();
                this.last = (tmp & 0x80) === 0x80,
                this.type = tmp & 0x7F,
                this.size = stream.readUInt24();
            }
            
            if (!this.foundStreamInfo && this.type !== STREAMINFO)
                return this.emit('error', 'STREAMINFO must be the first block');
                
            if (!stream.available(this.size))
                return;
            
            switch (this.type) {
                case STREAMINFO:
                    if (this.foundStreamInfo)
                        return this.emit('error', 'STREAMINFO can only occur once.');
                    
                    if (this.size !== STREAMINFO_SIZE)
                        return this.emit('error', 'STREAMINFO size is wrong.');
                    
                    this.foundStreamInfo = true;
                    var bitstream = new Bitstream(stream);
                
                    var cookie = {
                        minBlockSize: bitstream.read(16),
                        maxBlockSize: bitstream.read(16),
                        minFrameSize: bitstream.read(24),
                        maxFrameSize: bitstream.read(24)
                    };
                
                    this.format = {
                        formatID: 'flac',
                        sampleRate: bitstream.read(20),
                        channelsPerFrame: bitstream.readSmall(3) + 1,
                        bitsPerChannel: bitstream.readSmall(5) + 1
                    };
                
                    this.emit('format', this.format);
                    this.emit('cookie', cookie);
                
                    var sampleCount = bitstream.readBig(36);
                    this.emit('duration', sampleCount / this.format.sampleRate * 1000 | 0);
                
                    stream.advance(16); // skip MD5 hashes
                    this.readBlockHeaders = false;
                    break;
                    
                case VORBIS_COMMENT:
                    // see http://www.xiph.org/vorbis/doc/v-comment.html
                    this.metadata || (this.metadata = {});
                    var len = stream.readUInt32(true);
                    
                    this.metadata.vendor = stream.readString(len);
                    var length = stream.readUInt32(true);
                    
                    for (var i = 0; i < length; i++) {
                        len = stream.readUInt32(true);
                        var str = stream.readUTF8(len),
                            idx = str.indexOf('=');
                            
                        this.metadata[str.slice(0, idx)] = str.slice(idx + 1);
                    }
                    
                    // TODO: standardize field names across formats
                    break;
                    
                case PICTURE:
                    var type = stream.readUInt32();
                    if (type !== 3) { // make sure this is album art (type 3)
                        stream.advance(this.size - 4);
                    } else {
                        var mimeLen = stream.readUInt32(),
                            mime = stream.readString(mimeLen),
                            descLen = stream.readUInt32(),
                            description = stream.readString(descLen),
                            width = stream.readUInt32(),
                            height = stream.readUInt32(),
                            depth = stream.readUInt32(),
                            colors = stream.readUInt32(),
                            length = stream.readUInt32(),
                            picture = stream.readBuffer(length);
                    
                        this.metadata || (this.metadata = {});
                        this.metadata['Cover Art'] = picture;
                    }
                    
                    // does anyone want the rest of the info?
                    break;
                
                default:
                    stream.advance(this.size);
                    this.readBlockHeaders = false;
            }
            
            if (this.last && this.metadata)
                this.emit('metadata', this.metadata);
        }
        
        while (stream.available(1) && this.last) {
            var buffer = stream.readSingleBuffer(stream.remainingBytes());
            this.emit('data', buffer, stream.remainingBytes() === 0);
        }
    }
    
});

FLACDecoder = Decoder.extend(function() {
    Decoder.register('flac', this);
    
    this.prototype.setCookie = function(cookie) {
        this.cookie = cookie;
        
        // initialize arrays
        this.decoded = [];
        for (var i = 0; i < this.format.channelsPerFrame; i++) {
            this.decoded[i] = new Int32Array(cookie.maxBlockSize);
        }
    };
    
    const BLOCK_SIZES = new Int16Array([
               0,      192, 576 << 0, 576 << 1, 576 << 2, 576 << 3,        0,        0,
        256 << 0, 256 << 1, 256 << 2, 256 << 3, 256 << 4, 256 << 5, 256 << 6, 256 << 7
    ]);
    
    const SAMPLE_RATES = new Int32Array([
        0, 88200, 176400, 192000,
        8000, 16000, 22050, 24000, 32000, 44100, 48000, 96000,
        0, 0, 0, 0
    ]);
    
    const SAMPLE_SIZES = new Int8Array([
        0, 8, 12, 0, 16, 20, 24, 0
    ]);
    
    const MAX_CHANNELS = 8,
          CHMODE_INDEPENDENT = 0,
          CHMODE_LEFT_SIDE = 8,
          CHMODE_RIGHT_SIDE = 9,
          CHMODE_MID_SIDE = 10;
    
    this.prototype.readChunk = function() {
        var stream = this.bitstream;
        
        if (!(stream.available(4096 << 6) || (this.receivedFinalBuffer && stream.available(48))))
            return this.once('available', this.readChunk);
                    
        // frame sync code
        if ((stream.read(15) & 0x7FFF) !== 0x7FFC)
            return this.emit('error', 'Invalid sync code');
            
        var isVarSize = stream.readOne(),  // variable block size stream code
            bsCode = stream.readSmall(4),  // block size
            srCode = stream.readSmall(4),  // sample rate code
            chMode = stream.readSmall(4),  // channel mode
            bpsCode = stream.readSmall(3); // bits per sample
            
        stream.advance(1); // reserved bit
        
        // channels
        this.chMode = chMode;
        var channels;
        
        if (chMode < MAX_CHANNELS) {
            channels = chMode + 1;
            this.chMode = CHMODE_INDEPENDENT;
        } else if (chMode <= CHMODE_MID_SIDE) {
            channels = 2;
        } else {
            return this.emit('error', 'Invalid channel mode');
        }
        
        if (channels !== this.format.channelsPerFrame)
            return this.emit('error', 'Switching channel layout mid-stream not supported.');
        
        // bits per sample    
        if (bpsCode === 3 || bpsCode === 7)
            return this.emit('error', 'Invalid sample size code');
            
        this.bps = SAMPLE_SIZES[bpsCode];
        if (this.bps !== this.format.bitsPerChannel)
            return this.emit('error', 'Switching bits per sample mid-stream not supported.');
        
        var sampleShift, is32;    
        if (this.bps > 16) {
            sampleShift = 32 - this.bps;
            is32 = true;
        } else {
            sampleShift = 16 - this.bps;
            is32 = false;
        }
        
        // sample number or frame number
        // see http://www.hydrogenaudio.org/forums/index.php?s=ea7085ffe6d57132c36e6105c0d434c9&showtopic=88390&pid=754269&st=0&#entry754269
        var ones = 0;
        while (stream.readOne() === 1)
            ones++;
        
        var frame_or_sample_num = stream.read(7 - ones);
        for (; ones > 1; ones--) {
            stream.advance(2); // == 2
            frame_or_sample_num = (frame_or_sample_num << 6) | stream.read(6);
        }
                
        // block size
        if (bsCode === 0)
            return this.emit('error', 'Reserved blocksize code');
        else if (bsCode === 6)
            this.blockSize = stream.read(8) + 1;
        else if (bsCode === 7)
            this.blockSize = stream.read(16) + 1;
        else
            this.blockSize = BLOCK_SIZES[bsCode];
            
        // sample rate
        var sampleRate;
        if (srCode < 12)
            sampleRate = SAMPLE_RATES[srCode];
        else if (srCode === 12)
            sampleRate = stream.read(8) * 1000;
        else if (srCode === 13)
            sampleRate = stream.read(16);
        else if (srCode === 14)
            sampleRate = stream.read(16) * 10;
        else
            return this.emit('error', 'Invalid sample rate code');
            
        stream.advance(8); // skip CRC check
        
        // subframes
        for (var i = 0; i < channels; i++) {
            if (this.decodeSubframe(i) < 0)
                return this.emit('error', 'Error decoding subframe ' + i);
        }
        
        stream.align();
        stream.advance(16); // skip CRC frame footer
        
        var output = new ArrayBuffer(this.blockSize * channels * this.bps / 8),
            buf = is32 ? new Int32Array(output) : new Int16Array(output),
            blockSize = this.blockSize,
            decoded = this.decoded,
            j = 0;
            
        switch (this.chMode) {
            case CHMODE_INDEPENDENT:
                for (var k = 0; k < blockSize; k++) {
                    for (var i = 0; i < channels; i++) {
                        buf[j++] = decoded[i][k] << sampleShift;
                    }
                }
                break;
                
            case CHMODE_LEFT_SIDE:
                for (var i = 0; i < blockSize; i++) {
                    var left = decoded[0][i],
                        right = decoded[1][i];

                    buf[j++] = left << sampleShift;
                    buf[j++] = (left - right) << sampleShift;
                }
                break;
                
            case CHMODE_RIGHT_SIDE:
                for (var i = 0; i < blockSize; i++) {
                    var left = decoded[0][i],
                        right = decoded[1][i];

                    buf[j++] = (left + right) << sampleShift;
                    buf[j++] = right << sampleShift;
                }
                break;
                
            case CHMODE_MID_SIDE:
                for (var i = 0; i < blockSize; i++) {
                    var left = decoded[0][i],
                        right = decoded[1][i];
                    
                    left -= right >> 1;
                    buf[j++] = (left + right) << sampleShift;
                    buf[j++] = left << sampleShift;
                }
                break;
        }
        
        this.emit('data', buf);
    };
    
    this.prototype.decodeSubframe = function(channel) {
        var wasted = 0,
            stream = this.bitstream,
            blockSize = this.blockSize,
            decoded = this.decoded;
        
        this.curr_bps = this.bps;
        if (channel === 0) {
            if (this.chMode === CHMODE_RIGHT_SIDE)
                this.curr_bps++;
        } else {
            if (this.chMode === CHMODE_LEFT_SIDE || this.chMode === CHMODE_MID_SIDE)
                this.curr_bps++;
        }
        
        if (stream.readOne()) {
            this.emit('error', "Invalid subframe padding");
            return -1;
        }
        
        var type = stream.readSmall(6);
        
        if (stream.readOne()) {
            wasted = 1;
            while (!stream.readOne())
                wasted++;

            this.curr_bps -= wasted;
        }
        
        if (this.curr_bps > 32) {
            this.emit('error', "decorrelated bit depth > 32 (" + this.curr_bps + ")");
            return -1;
        }
        
        if (type === 0) {
            var tmp = stream.readSigned(this.curr_bps);
            for (var i = 0; i < blockSize; i++)
                decoded[channel][i] = tmp;
                
        } else if (type === 1) {
            var bps = this.curr_bps;
            for (var i = 0; i < blockSize; i++)
                decoded[channel][i] = stream.readSigned(bps);
                
        } else if ((type >= 8) && (type <= 12)) {
            if (this.decode_subframe_fixed(channel, type & ~0x8) < 0)
                return -1;
                
        } else if (type >= 32) {
            if (this.decode_subframe_lpc(channel, (type & ~0x20) + 1) < 0)
                return -1;

        } else {
            this.emit('error', "Invalid coding type");
            return -1;
        }
        
        if (wasted) {
            for (var i = 0; i < blockSize; i++)
                decoded[channel][i] <<= wasted;
        }

        return 0;
    };
    
    this.prototype.decode_subframe_fixed = function(channel, predictor_order) {
        var decoded = this.decoded[channel],
            stream = this.bitstream,
            bps = this.curr_bps;
    
        // warm up samples
        for (var i = 0; i < predictor_order; i++)
            decoded[i] = stream.readSigned(bps);
    
        if (this.decode_residuals(channel, predictor_order) < 0)
            return -1;
        
        var a = 0, b = 0, c = 0, d = 0;
        
        if (predictor_order > 0) 
            a = decoded[predictor_order - 1];
        
        if (predictor_order > 1)
            b = a - decoded[predictor_order - 2];
        
        if (predictor_order > 2) 
            c = b - decoded[predictor_order - 2] + decoded[predictor_order - 3];
        
        if (predictor_order > 3)
            d = c - decoded[predictor_order - 2] + 2 * decoded[predictor_order - 3] - decoded[predictor_order - 4];
            
        switch (predictor_order) {
            case 0:
                break;
                
            case 1:
            case 2:
            case 3:
            case 4:
                var abcd = new Int32Array([a, b, c, d]),
                    blockSize = this.blockSize;
                    
                for (var i = predictor_order; i < blockSize; i++) {
                    abcd[predictor_order - 1] += decoded[i];
                    
                    for (var j = predictor_order - 2; j >= 0; j--) {
                        abcd[j] += abcd[j + 1];
                    }
                    
                    decoded[i] = abcd[0];
                }
                
                break;
                
            default:
                this.emit('error', "Invalid Predictor Order " + predictor_order);
                return -1;
        }
         
        return 0;
    };
    
    this.prototype.decode_subframe_lpc = function(channel, predictor_order) {
        var stream = this.bitstream,
            decoded = this.decoded[channel],
            bps = this.curr_bps,
            blockSize = this.blockSize;
            
        // warm up samples
        for (var i = 0; i < predictor_order; i++) {
            decoded[i] = stream.readSigned(bps);
        }

        var coeff_prec = stream.readSmall(4) + 1;
        if (coeff_prec === 16) {
            this.emit('error', "Invalid coefficient precision");
            return -1;
        }
        
        var qlevel = stream.readSigned(5);
        if (qlevel < 0) {
            this.emit('error', "Negative qlevel, maybe buggy stream");
            return -1;
        }
        
        var coeffs = new Int32Array(32);
        for (var i = 0; i < predictor_order; i++) {
            coeffs[i] = stream.readSigned(coeff_prec);
        }
        
        if (this.decode_residuals(channel, predictor_order) < 0) {
            return -1;
        }
        
        if (this.bps > 16) {
            this.emit('error', "no 64-bit integers in JS, could probably use doubles though");
            return -1;
        }
            
        for (var i = predictor_order; i < blockSize - 1; i += 2) {
            var d = decoded[i - predictor_order],
                s0 = 0, s1 = 0, c;

            for (var j = predictor_order - 1; j > 0; j--) {
                c = coeffs[j];
                s0 += c * d;
                d = decoded[i - j];
                s1 += c * d;
            }

            c = coeffs[0];
            s0 += c * d;
            d = decoded[i] += (s0 >> qlevel);
            s1 += c * d;
            decoded[i + 1] += (s1 >> qlevel);
        }

        if (i < blockSize) {
            var sum = 0;
            for (var j = 0; j < predictor_order; j++)
                sum += coeffs[j] * decoded[i - j - 1];

            decoded[i] += (sum >> qlevel);
        }

        return 0;
    };
    
    const INT_MAX = 32767;
    
    this.prototype.decode_residuals = function(channel, predictor_order) {
        var stream = this.bitstream,
            method_type = stream.readSmall(2);
            
        if (method_type > 1) {
            this.emit('error', 'Illegal residual coding method ' + method_type);
            return -1;
        }
        
        var rice_order = stream.readSmall(4),
            samples = (this.blockSize >>> rice_order);
            
        if (predictor_order > samples) {
            this.emit('error', 'Invalid predictor order ' + predictor_order + ' > ' + samples);
            return -1;
        }
        
        var decoded = this.decoded[channel],
            sample = predictor_order, 
            i = predictor_order;
        
        for (var partition = 0; partition < (1 << rice_order); partition++) {
            var tmp = stream.readSmall(method_type === 0 ? 4 : 5);

            if (tmp === (method_type === 0 ? 15 : 31)) {
                tmp = stream.readSmall(5);
                for (; i < samples; i++)
                    decoded[sample++] = stream.readSigned(tmp);
                    
            } else {
                for (; i < samples; i++)
                    decoded[sample++] = this.golomb(tmp, INT_MAX, 0);
            }
            
            i = 0;
        }
        
        return 0;
    };
    
    const MIN_CACHE_BITS = 25;
    
    this.prototype.golomb = function(k, limit, esc_len) {
        var data = this.bitstream,
            offset = data.bitPosition,
            buf = data.peekBig(32 - offset) << offset,
            v = 0;
        
        var log = 31 - clz(buf | 1); // log2(buf)

        if (log - k >= 32 - MIN_CACHE_BITS && 32 - log < limit) {
            buf >>>= log - k;
            buf += (30 - log) << k;

            data.advance(32 + k - log);
            v = buf;
            
        } else {
            for (var i = 0; data.read(1) === 0; i++)
                buf = data.peekBig(32 - offset) << offset;

            if (i < limit - 1) {
                if (k)
                    buf = data.read(k);
                else
                    buf = 0;

                v = buf + (i << k);
                
            } else if (i === limit - 1) {
                buf = data.read(esc_len);
                v = buf + 1;
                
            } else {
                v = -1;
            }
        }
        
        return (v >> 1) ^ -(v & 1);
    };
    
    // Should be in the damned standard library...
    function clz(input) {
        var output = 0,
            curbyte = 0;

        while(true) { // emulate goto in JS using the break statement :D
            curbyte = input >>> 24;
            if (curbyte) break;
            output += 8;

            curbyte = input >>> 16;
            if (curbyte & 0xff) break;
            output += 8;

            curbyte = input >>> 8;
            if (curbyte & 0xff) break;
            output += 8;

            curbyte = input;
            if (curbyte & 0xff) break;
            output += 8;

            return output;
        }

        if (!(curbyte & 0xf0))
            output += 4;
        else
            curbyte >>>= 4;

        if (curbyte & 0x8)
            return output;
            
        if (curbyte & 0x4)
            return output + 1;
            
        if (curbyte & 0x2)
            return output + 2;
            
        if (curbyte & 0x1)
            return output + 3;

        // shouldn't get here
        return output + 4;
    }
});