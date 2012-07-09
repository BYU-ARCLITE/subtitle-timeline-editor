var WaveForm = (function(){
	"use strict";
	function WaveForm(width, height, channels, rate){
		var start = 0, end = 0,
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
		this.events = {};
		
		this.moveToSample = function(s,e){
			var pstart, pend, ldraw, rdraw;
			if(s == start && e == end){
				this.emit('redraw');return;
			}
			if(e <= start || s >= end){
				start = s;
				end = e;
				this.redraw();
			}else{
				//find the overlap region
				pstart = s>start?this.sampleToPixel(s):0;
				pend = e<end?this.sampleToPixel(e):width;
				scalectx.putImageData(ctx.getImageData(pstart,0,pend-pstart,height),0,0);
				
				//find the length of the left redraw region
				ldraw = s<start?width*(start-s)/(e-s):0;
				//find the length of the right redraw region
				rdraw = e>end?width*(e-end)/(e-s):0;
				
				//draw the scaled overlap
				ctx.save();
				ctx.translate(ldraw,0);
				ctx.scale((end-start)/(e-s),1);
				ctx.clearRect(0,0,pend-pstart,height);
				ctx.drawImage(scalebuf,0,0);
				ctx.restore();
				
				end = e;
				start = s;
				if(ldraw){ draw.call(this, 0, ldraw); }
				if(rdraw){ draw.call(this, width-rdraw, width); }
				this.emit('redraw');
			}
		};
		
		this.moveToTime = function(s,e){
			this.moveToSample(Math.round(s*rate),Math.round(e*rate));
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
						this.redraw();
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
						this.redraw();
					}
					return width;
				},
				get: function(){ return height; },
				enumerable: true
			},
			startSample: {
				set: function(val){
					this.moveToSample(val,end);
					return start;
				},get: function(){return start;},
				enumerable: true
			},
			endSample: {
				set: function(val){
					this.moveToSample(start,val);
					return end;
				},get: function(){return end;},
				enumerable: true
			},
			sampleLength: {
				get: function(){
					return end-start;
				}, enumerable: true
			},
			startTime: {
				set: function(val){
					this.moveToSample(Math.round(val*rate),end);
					return start/rate;
				},get: function(){return start/rate;},
				enumerable: true
			},
			endTime: {
				set: function(val){
					this.moveToSample(start,Math.round(val*rate));
					return end/rate;
				},get: function(){return end/rate;},
				enumerable: true
			},
			timeLength: {
				get: function(){
					return (end-start)/rate;
				},enumerable: true
			}
		});
	}

	WaveForm.prototype.emit = function(evt, data){
		var that = this, fns = this.events[evt];
		fns && fns.forEach(function(cb){ cb.call(that,data); });
	};

	WaveForm.prototype.on = function(name, cb){
		if(name in this.events){ this.events[name].push(cb); }
		else{ this.events[name] = [cb]; }
	};
	
	WaveForm.prototype.sampleToPixel = function(s){
		return Math.round((s-this.startSample)*this.width/this.sampleLength);
	};

	WaveForm.prototype.addFrame = function(buffer){
		"use strict";
		var samples = this.samples/this.channels,
			start = this.startSample,
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
			else{
				draw.call(this,Math.floor(width*(samples-start)/len),width);
				this.emit('redraw');
			}
		}
	}

	WaveForm.prototype.redraw = function(){
		var channels = this.channels,
			start = this.startSample*channels,
			end = this.endSample*channels;
		if(this.worker){this.worker.terminate();}
		this.worker = new Worker("WaveWorker.js");
		this.worker.addEventListener('message',drawPath.bind(this));
		this.worker.postMessage({
			frame:new Float32Array(this.data.subarray(start, end)),
			channels:channels,
			rate:this.rate,
			length:(end-start)/channels,
			start:this.startSample,
			width:this.width,
			height:this.height,
			max:this.max
		});
	};
	
	function drawPath(e){
		var ctx = this.ctx,
			data = e.data,
			path = data.path,
			px = path[0], i;
		
		//TODO: figure out how to shift & scale this data, given that it may be outdated by now
		
		ctx.clearRect(0,0,this.width,this.height);
		
		ctx.save();
		ctx.lineWidth = 1;
		ctx.strokeStyle = "green";
		ctx.translate(0,this.height/2);
		ctx.beginPath(px.x,px.y);
		for(i=1;px=path[i];i++){ ctx.lineTo(px.x,px.y); }
		ctx.stroke();
		ctx.restore();
		this.emit('redraw');
	}
	
	function draw(startp,endp){
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
		k = channels*this.startSample;
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
	
	return WaveForm;
}());