//JavaScript Audio Resampler
//Based on resampler by Grant Galitz
//https://github.com/grantgalitz/XAudioJS
var Resampler = (function(){
	return function(fromSampleRate, toSampleRate, outputBufferSize, channels) {
		var outputBuffer;
		this.channels = channels | 0;
		this.outputBufferSize = outputBufferSize;
		this.lastOutput = 0; //for mono
		
		//Perform some checks:
		if (fromSampleRate <= 0 || toSampleRate <= 0 || channels <= 0) {
			throw(new Error("Invalid settings specified for the resampler."));
		}
		if (fromSampleRate === toSampleRate) {
			this.resampler = Bypass;
			this.ratioWeight = 1;
		} else {
			outputBuffer = new Float32Array(outputBufferSize);
			if (fromSampleRate < toSampleRate) {
				// Use generic linear interpolation if upsampling
				this.exec = channels === 1?
							MonoLinearInterpolation.bind(this,outputBuffer):
							LinearInterpolation.bind(this,channels,new Float32Array(channels),outputBuffer);
				this.lastWeight = 1;
			} else {
				// Custom downsampler by Grant Galitz
				this.exec = channels === 1?
							MonoMultiTap.bind(this,outputBuffer):
							MultiTap.bind(this,channels,new Float32Array(channels),outputBuffer);
				this.tailExists = false;
				this.lastWeight = 0;
			}
			this.ratioWeight = fromSampleRate / toSampleRate;
		}
	}

	function MonoLinearInterpolation(outputBuffer, buffer) {
		if(buffer.length <= 0){ return new Float32Array(0); }
		var bufferLength = buffer.length,
			outLength = this.outputBufferSize,
			ratioWeight = this.ratioWeight,
			weight = this.lastWeight,
			lastOutput = this.lastOutput,
			firstWeight = 0,
			secondWeight = 0,
			sourceOffset = 0,
			outputOffset = 0;
			
		for (; weight < 1; weight += ratioWeight) {
			secondWeight = weight % 1;
			firstWeight = 1 - secondWeight;
			outputBuffer[outputOffset++] = (lastOutput * firstWeight) + (buffer[0] * secondWeight);
		}
		weight -= 1;
		for (bufferLength -= channels, sourceOffset = Math.floor(weight); outputOffset < outLength && sourceOffset < bufferLength;) {
			secondWeight = weight % 1;
			firstWeight = 1 - secondWeight;
			outputBuffer[outputOffset++] = (buffer[sourceOffset] * firstWeight) + (buffer[sourceOffset+1] * secondWeight);
			weight += ratioWeight;
			sourceOffset = Math.floor(weight);
		}
		this.lastOutput = buffer[sourceOffset++];
		this.lastWeight = weight % 1;
		return bufferSlice(outputBuffer,outputOffset);
	}
	
	function LinearInterpolation(channels, lastOutput, outputBuffer, buffer) {
		var bufferLength = buffer.length,
			outLength = this.outputBufferSize;
		if(bufferLength % channels){
			throw(new Error("Buffer was of incorrect sample length."));
		}
		if(bufferLength <= 0){ return new Float32Array(0); }
		var ratioWeight = this.ratioWeight,
			weight = this.lastWeight,
			firstWeight = 0,
			secondWeight = 0,
			sourceOffset = 0,
			outputOffset = 0,
			sourceEnd, c, c2;
			
		for (; weight < 1; weight += ratioWeight) {
			secondWeight = weight % 1;
			firstWeight = 1 - secondWeight;
			for(c = 0; c < channels; ++c){
				outputBuffer[outputOffset++] = (lastOutput[c] * firstWeight) + (buffer[c] * secondWeight);
			}
		}
		weight -= 1;
		for (bufferLength -= channels, sourceOffset = Math.floor(weight) * channels; outputOffset < outLength && sourceOffset < bufferLength;) {
			secondWeight = weight % 1;
			firstWeight = 1 - secondWeight;
			sourceEnd = channels + sourceOffset;
			c2 = sourceOffset + channels;
			for(c = sourceOffset; c < sourceEnd; ++c){
				outputBuffer[outputOffset++] = (buffer[c] * firstWeight) + (buffer[c2++] * secondWeight);
			}
			weight += ratioWeight;
			sourceOffset = Math.floor(weight) * channels;
		}
		for(c = 0; c < channels; ++c){ lastOutput[c] = buffer[sourceOffset++]; }
		this.lastWeight = weight % 1;
		return bufferSlice(outputBuffer,outputOffset);
	}

	function MonoMultiTap(outputBuffer, buffer) {
		if (buffer.length <= 0){ return new Float32Array(0); }
		var bufferLength = buffer.length,
			outLength = this.outputBufferSize,
			ratioWeight = this.ratioWeight,
			weight = 0,
			actualPosition = 0,
			amountToNext = 0,
			alreadyProcessedTail = !this.tailExists,
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
			while (weight > 0 && actualPosition < bufferLength) {
				amountToNext = 1 + actualPosition - currentPosition;
				if (weight >= amountToNext) {
					output += buffer[actualPosition++] * amountToNext;
					currentPosition = actualPosition;
					weight -= amountToNext;
				} else {
					c2 = actualPosition;
					output += buffer[actualPosition] * weight;
					currentPosition += weight;
					weight = 0;
				}
			}
			if (weight != 0) { break; }
			outputBuffer[outputOffset++] = output / ratioWeight;
		} while (actualPosition < bufferLength && outputOffset < outLength);
				
		this.lastWeight = weight;
		this.lastOutput = output;
		this.tailExists = true;
				
		return bufferSlice(outputBuffer,outputOffset);
	}
	
	function MultiTap(channels, output, outputBuffer, buffer) {
		var bufferLength = buffer.length,
			outLength = this.outputBufferSize;
		if ((bufferLength % channels) == 0) {
			throw(new Error("Buffer was of incorrect sample length."));
		}
		if (bufferLength <= 0){ return new Float32Array(0); }
		var ratioWeight = this.ratioWeight,
			weight = 0,
			actualPosition = 0,
			amountToNext = 0,
			alreadyProcessedTail = !this.tailExists,
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
			while (weight > 0 && actualPosition < bufferLength) {
				amountToNext = 1 + actualPosition - currentPosition;
				if (weight >= amountToNext) {
					for(c = 0; c < channels; ++c){ output[c] += buffer[actualPosition++] * amountToNext; }
					currentPosition = actualPosition;
					weight -= amountToNext;
				} else {
					c2 = actualPosition;
					for(c = 0; c < channels; ++c){ output[c] += buffer[c2++] * weight; }
					currentPosition += weight;
					weight = 0;
				}
			}
			if (weight != 0) { break; }
			for(c = 0; c < channels; ++c){ outputBuffer[outputOffset++] = output[c] / ratioWeight; }
		} while (actualPosition < bufferLength && outputOffset < outLength);
		
		this.lastWeight = weight;
		this.tailExists = true;
		
		return bufferSlice(outputBuffer,outputOffset);
	}

	function Bypass(buffer) { return this.outputBuffer = buffer; }
	function bufferSlice(buf,size) { return buf[buf.subarray?'subarray':'slice'](0, size); }
}());