self.addEventListener('message',function(e){
	"use strict";
	var data = e.data,
		frame = data.frame,
		channels = data.channels,
		samples = frame.length/channels,
		length = data.length,
		rate = data.rate,
		width = data.width,
		max = data.max,
		f,fmax,fmin,
		i,k,j,l,m=0,
		xscale = (length||1)/width,
		yscale = data.height/2,
		step = Math.ceil(xscale),
		period = step - xscale,
		start,stop,end,path;
	
	step = step*channels;
	stop = Math.min(step*width,frame.length);
	if(stop==0){self.close();}
	
	path = [{x:0,y:Math.round(yscale*frame[0]/max)}];
	
	if(xscale > 1){ //more than 1 sample per pixel
		for(j=0,start=0;start<stop && j<width;start=end,j++){
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
			path.push(
				{x:j,y:Math.round(yscale*fmax)/max},
				{x:j,y:Math.round(yscale*fmin)/max}
			);
		}
	}else{
		xscale = 1/xscale;
		max *= channels;
		for(j=xscale;start<stop && j<width;start+=channels,j+=xscale){
			for(end=start+channels;start<end;start++){ f += frame[start]; }
			path.push({x:j,y:yscale*f/max});
		}
	}
	self.postMessage({
		path:path,
		start:data.start,
		length:length,
		width:width,
		height:data.height,
		step:step
	});
},false);