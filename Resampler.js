//JavaScript Audio Resampler
//Based on resampler by Grant Galitz
//https://github.com/grantgalitz/XAudioJS

//Assumes Typed Arrays;
//use http://www.calormen.com/polyfill/typedarray.js polyfill for Safari.

var Resampler = (function(){
	"use strict";
	//Constructor
	return function(fromRate, toRate, channels) {
		var ratio;
		this.channels = channels || 1;
		this.lastOutput = 0; //for mono
		
		//Perform some checks:
		if (fromRate <= 0 || toRate <= 0 || channels <= 0) {
			throw new Error("Invalid Resampler Settings");
		}
		if (fromRate === toRate) { this.resampler = Bypass; }
		else {
			ratio = fromRate / toRate;
			if (fromRate < toRate) {
				// Use generic linear interpolation if upsampling
				this.exec = channels === 1?
							MonoLinearInterp.bind(this,ratio):
							LinearInterp.bind(this,ratio,new Float32Array(channels),channels);
				this.lastWeight = 1;
			} else {
				// Custom downsampling algorithm by Grant Galitz
				this.exec = channels === 1?
							MonoMultiTap.bind(this,ratio):
							MultiTap.bind(this,ratio,new Float32Array(channels),channels);
				this.tailExists = false;
				this.lastWeight = 0;
			}
		}
	}

	function MonoLinearInterp(ratioWeight, inBuffer, outBuffer) {
		if(inBuffer.length <= 0){ return { sourceOffset: 0, outputOffset: 0 }; }
		var inLength = inBuffer.length,
			outLength = outBuffer.length,
			weight = this.lastWeight,
			lastOutput = this.lastOutput,
			firstWeight = 0,
			secondWeight = 0,
			sourceOffset = 0,
			outputOffset = 0;
			
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
		return { sourceOffset: sourceOffset+1, outputOffset: outputOffset };
	}
	
	function LinearInterp(ratioWeight, lastOutput, channels, inBuffer, outBuffer) {
		var inLength = inBuffer.length,
			outLength = outBuffer.length;
		if(bufferLength % channels){
			throw new Error("Buffer was of incorrect sample length.");
		}
		if(inLength <= 0){ return { sourceOffset: 0, outputOffset: 0 }; }
		var weight = this.lastWeight,
			firstWeight = 0,
			secondWeight = 0,
			sourceOffset = 0,
			outputOffset = 0,
			sourceEnd, c, c2;
			
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
		return { sourceOffset: sourceOffset+channels, outputOffset: outputOffset };
	}

	function MonoMultiTap(ratioWeight, inBuffer, outBuffer) {
		if (inBuffer.length <= 0){ return { sourceOffset: 0, outputOffset: 0 }; }
		var inLength = inBuffer.length,
			outLength = outBuffer.length,
			weight = 0,
			amountToNext = 0,
			alreadyProcessedTail = !this.tailExists,
			sourceOffset = 0,
			outputOffset = 0,
			currentPosition = 0,
			output;
		
		this.tailExists = false;
		
		do {
			if (alreadyProcessedTail) {
				weight = ratioWeight;
				output = 0;
			} else {
				weight = this.lastWeight;
				output = this.lastOutput;
				alreadyProcessedTail = true;
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
				
		return { sourceOffset: sourceOffset, outputOffset: outputOffset };
	}
	
	function MultiTap(ratioWeight, output, channels, inBuffer, outBuffer) {
		var inLength = inBuffer.length,
			outLength = outBuffer.length;
		if ((bufferLength % channels) == 0) {
			throw(new Error("Buffer was of incorrect sample length."));
		}
		if (bufferLength <= 0){ return { sourceOffset: 0, outputOffset: 0 }; }
		var weight = 0,
			amountToNext = 0,
			alreadyProcessedTail = !this.tailExists,
			sourceOffset = 0,
			outputOffset = 0,
			currentPosition = 0,
			c, c2;
		
		this.tailExists = false;
		
		do {
			if (alreadyProcessedTail) {
				weight = ratioWeight;
				for(c = 0; c < channels; ++c){ output[c] = 0; }
			} else {
				weight = this.lastWeight;
				alreadyProcessedTail = true;
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
		
		return { sourceOffset: sourceOffset, outputOffset: outputOffset };
	}

	function Bypass(inbuf,outbuf) {
		var inlen = inbuf.length,
			outlen = outbuf.length;
		if(inlen > outlen){
			outbuf.set(inbuf.subarray(0,outlen));
			return { sourceOffset: outlen, outputOffset: outlen };
		}else{
			outbuf.set(inbuf);
			return { sourceOffset: inlen, outputOffset: inlen };
		}
	}
}());