//JavaScript Audio Resampler

var Resampler = (function(){
	"use strict";
	
	var blobURL = URL.createObjectURL(
		new Blob(
			['(' + workerFn.toString() + ')();'],
			{type: "text/javascript"}
		)
	);
	
	//Constructor
	return function(fromRate, toRate, channels) {
		var worker, that = this;
		
		//Perform some checks:
		if (fromRate <= 0 || toRate <= 0 || channels <= 0) {
			throw new Error("Invalid Resampler Settings");
		}
		this.receive = function(){};
		if (fromRate === toRate) {
			this.run = Bypass;
		} else {
			worker = new Worker(blobURL);
			worker.postMessage({
				type: "setup",
				channels: channels || 1,
				ratio: fromRate / toRate
			});
			worker.addEventListener('message',function(e){
				var data = e.data;
				data.inBuffer = new Float32Array(data.inBuffer);
				data.outBuffer = new Float32Array(data.outBuffer);
				that.receive(data);
			},false);
			this.run = function(inBuffer, outBuffer){
				//Have to transfer ArrayBuffers, not TypedArrays
				worker.postMessage({
					type: "exec",
					inBuffer: inBuffer.buffer,
					outBuffer: outBuffer.buffer
				},[inBuffer.buffer,outBuffer.buffer]);
			};			
		}
	}

	function Bypass(inbuf,outbuf) {
		var offset = Math.min(inbuf.length,outbuf.length);
		outbuf.set(inbuf.subarray(0,offset));
		this.receive({
			inBuffer: inbuf,
			outBuffer: outbuf,
			sourceOffset: offset,
			outputOffset: offset
		});
	}
	
	function workerFn(){
		this.addEventListener('message',function(e){
			"use strict";
			var data = e.data, offsets;
			switch(data.type){
			case "exec":
				offsets = this.exec(new Float32Array(data.inBuffer),new Float32Array(data.outBuffer));
				this.postMessage({
					inBuffer: data.inBuffer,
					outBuffer: data.outBuffer,
					sourceOffset: offsets.sourceOffset,
					outputOffset: offsets.outputOffset
				},[data.inBuffer,data.outBuffer])
				break;
			case "setup":
				this.lastOutput = 0; //for mono
				if (data.ratio < 1) {
					// Use generic linear interpolation for upsampling
					this.exec = data.channels === 1?
								MonoLinearInterp.bind(this,data.ratio):
								LinearInterp.bind(this,data.ratio,new Float32Array(data.channels),data.channels);
					this.lastWeight = 1;
				} else {
					//Downsampling based on algorithm by Grant Galitz
					//https://github.com/grantgalitz/XAudioJS
					this.exec = data.channels === 1?
								MonoMultiTap.bind(this,data.ratio):
								MultiTap.bind(this,data.ratio,new Float32Array(data.channels),data.channels);
					this.tailExists = false;
					this.lastWeight = 0;
				}
				
			}
		},false);

		function MonoLinearInterp(ratioWeight, inBuffer, outBuffer) {
			var weight = this.lastWeight,
				lastOutput = this.lastOutput,
				inLength = inBuffer.length,
				outLength = outBuffer.length,
				firstWeight = 0,
				secondWeight = 0,
				sourceOffset = 0,
				outputOffset = 0;
				
			if(inLength > 0 && outLength > 0){		
				for (; weight < 1; weight += ratioWeight) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					outBuffer[outputOffset++] = (lastOutput * firstWeight) + (inBuffer[0] * secondWeight);
				}
				weight -= 1;
				for (inLength -= channels, sourceOffset = Math.floor(weight); outputOffset < outLength && sourceOffset < bufferLength;) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					outBuffer[outputOffset++] = (inBuffer[sourceOffset] * firstWeight) + (inBuffer[sourceOffset+1] * secondWeight);
					weight += ratioWeight;
					sourceOffset = Math.floor(weight);
				}
				this.lastOutput = inBuffer[sourceOffset];
				this.lastWeight = weight % 1;
			}else{ sourceOffset = -1; }
			return {
				sourceOffset: sourceOffset+1,
				outputOffset: outputOffset
			};
		}

		function LinearInterp(ratioWeight, lastOutput, channels, inBuffer, outBuffer) {
			var inLength = inBuffer.length,
				outLength = outBuffer.length,
				weight = this.lastWeight,
				firstWeight = 0,
				secondWeight = 0,
				sourceOffset = 0,
				outputOffset = 0,
				sourceEnd, c, c2;
				
			inLength -= inLength % channels;
			outLength -= outLength % channels;
			if(inLength > 0 && outLength > 0){ 
				for (; weight < 1; weight += ratioWeight) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					for(c = 0; c < channels; ++c){
						outBuffer[outputOffset++] = (lastOutput[c] * firstWeight) + (inBuffer[c] * secondWeight);
					}
				}
				weight -= 1;
				for (bufferLength -= channels, sourceOffset = Math.floor(weight) * channels; outputOffset < outLength && sourceOffset < inLength;) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					sourceEnd = channels + sourceOffset;
					c2 = sourceOffset + channels;
					for(c = sourceOffset; c < sourceEnd; ++c){
						outBuffer[outputOffset++] = (inBuffer[c] * firstWeight) + (inBuffer[c2++] * secondWeight);
					}
					weight += ratioWeight;
					sourceOffset = Math.floor(weight) * channels;
				}
				lastOutput.set(inBuffer.subarray(sourceOffset));
				this.lastWeight = weight % 1;
			}else{ sourceOffset -= channels; }
			return {
				sourceOffset: sourceOffset+channels,
				outputOffset: outputOffset
			};
		}

		function MonoMultiTap(ratioWeight, inBuffer, outBuffer) {
			var inLength = inBuffer.length,
				outLength = outBuffer.length,
				weight = 0,
				amountToNext = 0,
				processTail = this.tailExists,
				sourceOffset = 0,
				outputOffset = 0,
				currentPosition = 0,
				output;
			
			if (inLength > 0 && outLength > 0){
				do {
					if (processTail) {
						weight = this.lastWeight;
						output = this.lastOutput;
						processTail = false;
					} else {
						weight = ratioWeight;
						output = 0;
					}
					while (weight > 0 && sourceOffset < inLength) {
						amountToNext = 1 + sourceOffset - currentPosition;
						if (weight >= amountToNext) {
							output += inBuffer[sourceOffset++] * amountToNext;
							currentPosition = sourceOffset;
							weight -= amountToNext;
						} else {
							output += inBuffer[sourceOffset] * weight;
							currentPosition += weight;
							weight = 0;
						}
					}
					if (weight != 0) { break; }
					outBuffer[outputOffset++] = output / ratioWeight;
				} while (sourceOffset < inLength && outputOffset < outLength);
					
				this.lastWeight = weight;
				this.lastOutput = output;
				this.tailExists = true;
			}	
			return {
				sourceOffset: sourceOffset,
				outputOffset: outputOffset
			};
		}

		function MultiTap(ratioWeight, output, channels, inBuffer, outBuffer) {
			var inLength = inBuffer.length,
				outLength = outBuffer.length,
				weight = 0,
				amountToNext = 0,
				processTail = this.tailExists,
				sourceOffset = 0,
				outputOffset = 0,
				currentPosition = 0,
				c, c2;
			
			inLength -= inLength % channels;
			outLength -= outLength % channels;
			if (inLength > 0 && outLength > 0){ 	
				do {
					if (processTail) {
						weight = this.lastWeight;
						processedTail = false;
					} else {
						weight = ratioWeight;
						for(c = 0; c < channels; ++c){ output[c] = 0; }
					}
					while (weight > 0 && sourceOffset < inLength) {
						amountToNext = 1 + sourceOffset - currentPosition;
						if (weight >= amountToNext) {
							for(c = 0; c < channels; ++c){ output[c] += inBuffer[sourceOffset++] * amountToNext; }
							currentPosition = sourceOffset;
							weight -= amountToNext;
						} else {
							c2 = sourceOffset;
							for(c = 0; c < channels; ++c){ output[c] += inBuffer[c2++] * weight; }
							currentPosition += weight;
							weight = 0;
						}
					}
					if (weight != 0) { break; }
					for(c = 0; c < channels; ++c){ outBuffer[outputOffset++] = output[c] / ratioWeight; }
				} while (sourceOffset < bufferLength && outputOffset < outLength);
				
				this.lastWeight = weight;
				this.tailExists = true;
			}
			return {
				sourceOffset: sourceOffset,
				outputOffset: outputOffset
			};
		}
	}
}());