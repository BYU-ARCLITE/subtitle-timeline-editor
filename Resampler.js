//JavaScript Audio Resampler

var Resampler = (function(){
	"use strict";

	var blobURL = URL.createObjectURL(
		new Blob(
			['(' + workerFn.toString() + ')();'],
			{type: "text/javascript"}
		)
	);

	var arrayTypes = {
		8: Int8Array,
		16: Int16Array,
		32: Float32Array,
		64: Float64Array
	};

	function Resampler(opts){
		var worker, that = this,
			fromRate = +opts.from || 0,
			toRate = +opts.to || 0,
			channels = +opts.channels || 0,
			cons = arrayTypes[opts.bitrate] || Float32Array;

		//Perform some checks:
		if (fromRate <= 0 || toRate <= 0 || channels <= 0) {
			throw new Error("Invalid Resampler Settings");
		}

		//TODO: Implement Reset properly

		this.events = {};
		if (fromRate === toRate) {
			//Bypass- copy inputs to outputs of the appropriate type
			//TODO: make this respect the output buffer size option
			this.append = function(inputs) {
				this.emit('data',inputs.map(function(a){ return new cons(a); }));
			};
			this.flush = function(){
				var i, buffers = [];
				for(i = 0; i < channels; ++i){ buffers.push(new ArrayBuffer(0)); }
				this.emit('data',buffers);
			};
			this.reset = function(){};
		} else {
			worker = new Worker(blobURL);
			worker.postMessage({
				cmd: "init",
				bitrate: opts.bitrate,
				channels: channels,
				ratio: fromRate / toRate,
				outLength: +opts.bufferSize || 4096
			});
			worker.addEventListener('message',function(e){
				that.emit('data',e.data);
			},false);
			worker.addEventListener('error',function(e){
				console.log(e);
				that.emit('error',e);
			},false);
			this.append = function(inputs){
				worker.postMessage({
					cmd: "exec",
					inputs: inputs
				});
			};
			this.flush = function(){ worker.postMessage({cmd: "flush"}); };
			this.reset = function(){};
		}
	}

	Resampler.prototype.on = function(ename, handler){
		if(!this.events.hasOwnProperty(ename)){
			this.events[ename] = [handler];
		}else{
			this.events[ename].push(handler);
		}
	};

	Resampler.prototype.off = function(ename, handler){
		var i, evlist = this.events[ename];
		if(!evlist){ return; }
		i = evlist.indexOf(handler);
		if(~i){ evlist.splice(i,1); }
	};

	Resampler.prototype.emit = function(ename, obj){
		var evlist = this.events[ename];
		if(!evlist){ return; }
		evlist.forEach(function(h){ h.call(this, obj); }, this);
	}

	return Resampler;

	function workerFn(){
		"use strict";
		var alg = null,
			buffers = null,
			excessLength = 0,
			channels,
			olen, cons;

		self.addEventListener('message',function(e){
			"use strict";
			var data = e.data,
				i, ratio, len;
			switch(data.cmd){
			case "init":
				cons = {
					8: Int8Array,
					16: Int16Array,
					32: Float32Array,
					64: Float64Array
				}[data.bitrate] || Float32Array;
				ratio = data.ratio;
				channels = data.channels;
				olen = data.outLength;
				buffers = [];
				for(i = 0; i < channels; ++i){ buffers.push(new cons(olen)); }
				alg = new Algorithm(ratio, channels);
				break;
			case "exec":
				len = Math.min.apply(Math, data.inputs.map(function(a){ return a.length; }));
				if(isFinite(len)){ Exec(data.inputs, len); }
				break;
			case "flush":
				Flush();
				alg.reset();
				break;
			}
		},false);

		//Re-use the same output buffers over and over,
		//copying them to the main thread when they become
		//full, until we exhaust the available input
		function Exec(inArrays, inLength){
			var offsets,
				outOffset, inOffset,
				outArrays, outLength;

			//Acquire output arrays
			if(excessLength > 0){
				outLength = excessLength;
				outOffset = olen - excessLength;
				outArrays = buffers.map(function(b){ return b.subarray(outOffset); });
			}else{
				outLength = olen;
				outArrays = buffers;
			}

			do {
				offsets = alg.exec(inLength, outLength, inArrays, outArrays);
				outOffset = offsets.outputOffset;
				inOffset = offsets.inputOffset;

				if(outOffset >= outLength){
					//copy output buffers to main thread
					self.postMessage(buffers);
					//reset output arrays
					outLength = olen;
					outArrays = buffers;
				}

				if(inOffset >= inLength){ break; } //input was exhausted
				//Otherwise, shift the inputs
				inLength -= inOffset;
				inArrays = inArrays.map(function(a){ return a.subarray(inOffset); });
			}while(true);
			excessLength = outLength - outOffset;
		}

		function Flush(){
			var nbufs, index;
			if(excessLength > 0){
				index = olen = excessLength;
				self.postMessage(buffers.map(function(b){ return b.subarray(index); }));
				excessLength = 0;
			}else{
				self.postMessage(buffers.map(function(){ return new cons(0); }));
			}
		}

		function Algorithm(ratio,channels){
			this.channels = channels;
			this.ratio = ratio;
			this.lastWeight = 0;
			this.lastOutput = new Float64Array(channels);
			//TODO: create mono-optimized versions
			this.exec = ratio < 1?LinearInterp:FractionalMean;
		}

		Algorithm.prototype.reset = function(){
			var i;
			this.lastWeight = 0;
			for(i = 0; i < this.channels; ++i){
				this.lastOutput[i] = 0;
			}
		};

		/*
		 * Each output sample consists of the sum of some window of input samples,
		 * plus some fraction of a prior sample and some fraction of a following
		 * sample, all scaled according to the resampling ratio.
		 */
		function FractionalMean(inLength, outLength, inBuffers, outBuffers) {
			var ratio = this.ratio,
				lastOutput = this.lastOutput,
				channels = this.channels,
				inputOffset = 0,
				outputOffset = 0,
				buffer, weight,
				postWeight, preWeight,
				start, sum, c, i;

			if (inLength > 0 && outLength > 0){

				weight = (this.lastWeight >= 1)?this.lastWeight:(ratio - this.lastWeight);
				start = inputOffset;
				inputOffset = Math.min(start + Math.floor(weight), inLength);
				postWeight = weight - (inputOffset - start);

				while(postWeight < 1 && outputOffset < outLength && inputOffset < inLength) {
					//we can produce a complete output sample
					preWeight = 1-postWeight;
					//Do one channel at a time to optimize data locality
					for(c = 0; c < channels; ++c){
						buffer = inBuffers[c];
						sum = lastOutput[c]; //partial prior sample
						//Sum intermediate full samples
						for (i = start; i < inputOffset; ++i) { sum += buffer[i];	}
						//add partial following sample and normalize
						outBuffers[c][outputOffset] = (sum + buffer[i] * postWeight) / ratio;
						//setup prior partials for the next iteration
						lastOutput[c] = (preWeight < 1)?buffer[i] * preWeight:0;
					}

					weight = ratio - preWeight;
					start = inputOffset+1;
					inputOffset = Math.min(start + Math.floor(weight), inLength);
					postWeight = weight - (inputOffset - start);

					outputOffset++;
				}
				//produce partial samples
				this.lastWeight = postWeight;
				for(c = 0; c < channels; ++c){
					buffer = inBuffers[c];
					sum = lastOutput[c]; //partial prior sample
					//Get as many full input samples as we can
					for (sum = 0, i = start; i < inputOffset; ++i) { sum += buffer[i];	}
					lastOutput[c] = sum;
				}
			}
			return {
				inputOffset: inputOffset,
				outputOffset: outputOffset
			};
		}

		function LinearInterp(inLength, outLength, inBuffers, outBuffers) {
			var ratioWeight = this.ratio,
				lastOutput = this.lastOutput,
				channels = this.channels,
				outputOffset = 0,
				inputOffset = 0,
				weight,	preweight,
				firstSamples,
				ibuf, c;

			if(inLength > 0 && outLength > 0){
				inputOffset = 1;
				weight = this.lastWeight;
				firstSamples = inBuffers.map(function(a){ return a[0]; });
				while(weight < 1 && outputOffset < outLength){
					preweight = 1 - weight;
					for(c = 0; c < channels; ++c){
						outBuffers[c][outputOffset] = (lastOutput[c] * preweight) + (firstSamples[c] * weight);
					}
					weight += ratioWeight;
					outputOffset++;
				}
				weight -= 1;
				while(outputOffset < outLength && inputOffset < inLength) {
					preweight = 1 - weight;
					for(c = 0; c < channels; ++c){
						ibuf = inBuffers[c];
						outBuffers[c][outputOffset] = (ibuf[inputOffset-1] * preweight) + (ibuf[inputOffset] * weight);
					}
					weight += ratioWeight;
					outputOffset++;
					if(weight >= 1){
						inputOffset++;
						weight -= 1;
					}
				}
				for(c = 0; c < channels; ++c){ lastOutput[c] = inBuffers[c][inputOffset]; }
				this.lastWeight = weight % 1;
			}
			return {
				inputOffset: inputOffset,
				outputOffset: outputOffset
			};
		}
	}
}());