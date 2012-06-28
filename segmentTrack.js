segmentTrack = (function(){
	"use strict";
	function segmentTrack(tl, cues, id, language, karaoke){
		this.tl = tl;
		this.id = id;
		this.language = language;
		this.karaoke = !!karaoke;
		this.segments = cues.map(function(cue){
			var seg = (cue instanceof Segment)?cue:new Segment(tl, cue);
			seg.track = id;
			return seg;
		});
		this.audio = null;
	}

	segmentTrack.prototype.searchRange = function(low, high){
		return this.segments.filter(function(seg){
			return seg.startTime < high && seg.endTime > low;
		});
		/*var segs = this.segments,
			len = segs.length,
			startIndex  = 0,
			stopIndex   = len - 1,
			middle      = Math.floor(stopIndex/2),
			scan;

		while(startIndex < stopIndex){
			if(segs[middle].endTime < low){
				startIndex = middle + 1;
			}else if(segs[middle].startTime > high){
				stopIndex = middle - 1;
			}else{break;}
			middle = Math.floor((stopIndex + startIndex)/2);
		}
		if(stopIndex == 0 || startIndex == len){
			return [];
		}
		while(scan >= 0 && segs[scan].endTime > low){
			scan--;
		}
		while(middle < len && segs[middle].startTime < high){
			middle++;
		}
		return segs.slice(scan+1,middle);
		//return segs.slice(searchLow(segs,low,middle),searchHigh(segs,high,middle));
		*/
	};

	segmentTrack.prototype.render = function(){
		var that = this,
			tl = this.tl,
			startTime = tl.view.startTime,
			top = tl.getTrackTop(this.id),
			width = tl.view.width,
			height = tl.segmentTrackHeight,
			ctx = tl.ctx,
			audio = this.audio;
			
		ctx.drawImage(tl.trackBg, 0, top, width, height);
		this.searchRange(startTime,tl.view.endTime).forEach(function(seg){ seg.render(); });
		if(audio && tl.selectedSegment && /*!tl.slider.resize &&*/ tl.tracks[tl.selectedSegment.track] === this){
			audio.shift(startTime/1000,tl.view.length/1000);
			ctx.save();
			ctx.globalAlpha = .5;
			ctx.drawImage(audio.buffer, 0, top, width, height);					
			ctx.restore();
		}
	};

	
	//find the first element that is in view
	function searchLow(segs, low, stopIndex){
		var len = segs.length,
			startIndex  = 0,
			middle      = Math.floor(stopIndex/2);

		while(startIndex < stopIndex){
			if(segs[middle].endTime > low)
				{ stopIndex = middle - 1; }
			else{ startIndex = middle + 1; }
			middle = Math.floor((stopIndex + startIndex)/2);
		}
		return middle <= 0 ? 0 : (segs[middle].endTime > low ? middle : middle + 1);
	}

	//find the first element that has gone out of view
	function searchHigh(segs, high, startIndex){
		var len = segs.length,
			stopIndex   = len - 1,
			middle      = Math.floor(stopIndex/2);

		while(startIndex < stopIndex){
			if(segs[middle].startTime < high)
				{ startIndex = middle + 1; }
			else{ stopIndex = middle - 1; }
			middle = Math.floor((stopIndex + startIndex)/2);
		}
		return middle >= len ? len : (segs[middle].startTime < high ? middle + 1 : middle);
	}
	
	return segmentTrack;
}());