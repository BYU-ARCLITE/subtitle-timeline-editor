var WaveForm = (function(){

	function WaveForm(width, height, channels, rate){
		"use strict";
		var start = 0, length = 0,
			buffer = document.createElement('canvas'),
			scalebuf = document.createElement('canvas'),
			ctx = buffer.getContext('2d'),
			scalectx = scalebuf.getContext('2d'),
			audiobuffer = [];
		
		scalebuf.width = buffer.width = width;
		scalebuf.height = buffer.height = height;
		
		this.buffer = buffer;
		this.ctx = ctx;	
		this.channels = channels;
		this.rate = rate;
		this.frames = [];
		this.max = 0;
		this.samples = 0;
		this.worker = null;
		
		this.sampleShift = function(x,l){
			if(x == start){
				if(l!=length){
					this.sampleLength = l;
				}
			}else if(l==length){
				this.sampleStart = x;
			}else{
				start = x>0?x:0;
				length = l>0?l:0;
				this.redraw();
			}
		};
		
		Object.defineProperties(this,{
			data: {
				get: function(){
					var i,offset,frame,newbuffer;
					if(this.frames.length){
						newbuffer = new Float32Array(this.samples);
						newbuffer.set(audiobuffer);
						for(i=0,offset=audiobuffer.length;frame=this.frames[i];i++){
							newbuffer.set(frame,offset);
							offset+=frame.length;
						}
						this.frames = [];
						audiobuffer = newbuffer;
					}
					return audiobuffer;
				}
			},
			width: {
				set: function(val){
					if(val != width){
						scalebuf.width = buffer.width = width = val;
					}
					return width;
				},
				get: function(){ return width; },
				enumerable: true
			},
			height: {
				set: function(val){
					if(val != height){
						scalebuf.height = buffer.height = height = val;
					}
					return width;
				},
				get: function(){ return height; },
				enumerable: true
			},
			sampleStart: {
				set: function(val){
					var diff;
					if(val < 0){val = 0;}
					else if(val > this.samples){val = this.samples;}
					if(val != start){
						if(this.sampleLength > 150000){
							diff = Math.round(width*(val-start)/length);
							start = val;
							
							if(Math.abs(diff) < width/1.5){ //there's significant overlap
								if(diff > 0){ //moving forward
									ctx.putImageData(ctx.getImageData(diff,0,width-diff,height),0,0);
									this.redrawPart(width-Math.max(diff,10),width);
								}else{ //moving backward
									diff = 0-diff;
									ctx.putImageData(ctx.getImageData(0,0,width-diff,height),diff,0);
									this.redrawPart(0,Math.max(diff,10));
								}
							}
							return start;
						}
						start = val;
						drawMono.call(this,0,width);
					}
					return start;
				},get: function(){return start;},
				enumerable: true
			},
			sampleLength: {
				set: function(val){
					var newcv, scale, idata;
					if(val < 0){val = 0;}
					if(val != length){
						scale = length/val;
						length = val;
						if(scale < 1){
							idata = ctx.getImageData(0,0,width,height);
							this.redrawPart(Math.floor(width*scale),width);
						}else{
							idata = ctx.getImageData(0,0,Math.ceil(width/scale),height);
						}
						scalectx.putImageData(idata,0,0);
						ctx.save();
						ctx.scale(scale,1);
						ctx.drawImage(scalebuf,0,0);
						ctx.restore();
					}
					return length;
				},get: function(){return length;},
				enumerable: true
			},
			start: {
				set: function(val){
					return this.sampleStart = Math.round(val*this.rate);
				},get: function(){return start/this.rate;},
				enumerable: true
			},
			length: {
				set: function(val){
					return this.sampleLength = Math.round(val*this.rate);
				},get: function(){return length/this.rate;},
				enumerable: true
			}
		});
	}

	WaveForm.prototype.shift = function(x, l){
		this.sampleShift(Math.round(x*this.rate),Math.round(l*this.rate));
	}

	WaveForm.prototype.addFrame = function(buffer){
		"use strict";
		var samples = this.samples/this.channels,
			start = this.sampleStart,
			len = this.sampleLength,
			width, i, f, newm,
			fmax=Number.NEGATIVE_INFINITY,
			fmin=Number.POSITIVE_INFINITY,
			mchange=false;
			
		for(i=0;i<buffer.length;i+=32768){
			f = buffer.subarray(i,i+32768);
			fmax = Math.max(fmax,Math.max.apply(null,f));
			fmin = Math.min(fmin,Math.min.apply(null,f));
		}
		newm = Math.max(fmax,Math.abs(fmin));
		if(newm > this.max){
			mchange = true;
			this.max = newm;
		}
		this.frames.push(buffer);
		this.samples+=buffer.length;
		if(samples > start && samples < start+len){
			width = this.width;
			if(mchange){this.redraw();}
			else{this.redrawPart(Math.floor(width*(samples-start)/len),width);}
		}
	}

	WaveForm.prototype.redraw = function(cb){
		var channels = this.channels,
			start = this.sampleStart*channels,
			end = start+this.sampleLength*channels;
		if(this.worker){this.worker.terminate();}
		this.worker = new Worker("waveWorker.js");
		this.worker.addEventListener('message',drawPath.bind(this,cb));
		this.worker.postMessage({
			frame:new Float32Array(this.data.subarray(start, end)),
			channels:channels,
			rate:this.rate,
			width:this.width,
			height:this.height,
			max:this.max		
		});
		//drawChannels.call(this,0,this.width);
	};

	WaveForm.prototype.redrawPart = function(startp,endp){
		drawMono.call(this,startp,endp);
		//drawChannels.call(this,startp,endp);
	};
	
	function drawPath(cb,e){
		var ctx = this.ctx,
			path = e.data,
			px = path[0], i;
		ctx.clearRect(0,0,this.width,this.height);
		
		ctx.save();
		ctx.lineWidth = 1;
		ctx.strokeStyle = "green";
		ctx.translate(0,this.height/2);
		ctx.beginPath(px.x,px.y);
		for(i=1;px=path[i];i++){ ctx.lineTo(px.x,px.y); }
		ctx.stroke();
		ctx.restore();
		cb&&cb();
	}
	
	function drawMono(startp,endp){
		"use strict";
		var i,k,j,l,m=0,
			f,fmax,fmin,
			ctx = this.ctx,
			max = this.max,
			frame = this.data,
			channels = this.channels,
			xscale = (this.sampleLength||1)/this.width,
			yscale = this.height/2,
			step = Math.ceil(xscale),
			period = step - xscale,
			start,stop,step,end;
		
		step = step*channels;
		k = channels*this.sampleStart;
		start = k+step*startp;
		stop = Math.min(k+step*endp,this.samples);
		
		ctx.clearRect(startp,0,endp-startp,this.height);
		if(start >= stop){return;}
		
		frame = frame.subarray(start,stop);
		stop-=start;
		start = 0;
		
		ctx.save();
		ctx.translate(startp,yscale);
		endp-=startp;
		
		ctx.lineWidth = 1;
		ctx.strokeStyle = "green";

		ctx.beginPath(0,Math.round(yscale*frame[start]/max));
		
		if(xscale > 1){ //more than 1 sample per pixel
			for(j=0;start<stop && j<endp;start=end,j++){
				//determine sample window size
				m += period;
				if(m>1){
					m -= 1;
					end = start + step - channels;
				}else{
					end = start + step;
				}
				if(end>stop){end = stop;}
				f = frame.subarray(start,end);
				fmax = Math.max.apply(null,f);
				fmin = Math.min.apply(null,f);
				ctx.lineTo(j,Math.round(yscale*fmax)/max);
				ctx.lineTo(j,Math.round(yscale*fmin)/max);
			}
		}else{
			xscale = 1/xscale;
			max *= channels;
			for(j=xscale;start<stop && j<endp;start+=channels,j+=xscale){
				for(end=start+channels;start<end;start++){ f += frame[start]; }
				ctx.lineTo(j,yscale*f/max);
			}
		}
		ctx.stroke();
		ctx.restore();
	}

	function drawChannels(startp,endp){
		"use strict";
		var e,i,k,j,l,s,m=0,
			f,fmax,fmin,
			ctx = this.ctx,
			max = this.max,
			frames = this.frames,
			framesize = this.framesize,
			channels = this.channels,
			xscale = (this.sampleLength||1)/this.width,
			yscale = this.height/(2*channels),
			step = Math.ceil(xscale),
			period = step - xscale,
			start,stop,step,
			frame,framenum;
		
		step = step*channels;
		k = channels*this.sampleStart;
		start = k+step*startp;
		stop = Math.min(k+step*endp,this.samples);
		endp-=startp;
		
		ctx.clearRect(startp,0,endp,this.height);
		
		if(start > stop){return;}
		
		ctx.save();
		ctx.translate(startp,yscale);
		
		ctx.lineWidth = 1;
		ctx.strokeStyle = "green";
		for(k=0;k<channels;k++){
			l = k+start;
			i = l%framesize;
			framenum = Math.floor(l/framesize);
			frame = frames[framenum];
			
			ctx.save()
			ctx.translate(0,-2*k*yscale);
			ctx.beginPath(0,Math.round(yscale*frame[i]/max));

			if(xscale > 1){ //more than 1 sample per pixel
				for(j=0;l<stop && j<endp;l+=step,j++){
					//iterate over a sampling range to find max amplitude
					m += period;
					if(m>1){ //decrease the sampling window length
						l -= channels;
						m -= 1;
					}
					for(fmax=0,fmin=0,e=l+step;l<e && l<stop;i+=channels,l+=channels){
						if(i>=framesize){
							i-=framesize;
							frame = frames[++framenum];
						}
						s = frame[i];
						if(s > fmax){ fmax = s; }
						else if(s < fmin){ fmin = s;}
					}
					ctx.lineTo(j,Math.round(yscale*(fmax+fmin>0?fmax:fmin)/max));
				}
			}else{
				xscale = 1/xscale;
				for(j=0;l<stop && j<endp;i+=channels,l+=channels,j+=xscale){
					if(i>=framesize){
						i-=framesize;
						frame = frames[++framenum];
					}
					ctx.lineTo(j,yscale*frame[i]/max);
				}
			}
			ctx.stroke();
			ctx.restore();
		}
		ctx.restore();
	}
	
	return WaveForm;
}());