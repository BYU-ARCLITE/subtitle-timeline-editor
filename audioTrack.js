audioTrack = (function(){
	"use strict";
	function audioTrack(tl, wave, id){
		var refs = 0;
		this.tl = tl;
		this.id = id;
		this.wave = wave;
		
		tl.tracks.forEach(function(track){
			if(track.audioId === id) refs++;
		});
		
		this.references = refs;
		
		wave.on('redraw',function(){
			var i, track,
				width = tl.view.width,
				height = tl.segmentTrackHeight,
				padding = tl.segmentTrackPadding,
				top = tl.keyHeight + padding,
				ctx = tl.octx;
				
			ctx.save();
			ctx.globalAlpha = .5;
			for(i=0;track=tl.tracks[i];i++){
				if(track.active && track.audioId === id){
					ctx.clearRect(0, top, width, height);
					ctx.drawImage(wave.buffer, 0, top);
				}
				top += height + padding;
			}
			ctx.restore();
		});
	}

	audioTrack.prototype.render = function(){
		var view;
		if(this.references){
			view = this.tl.view;
			this.wave.moveToTime(view.startTime,view.endTime);
		}
	};
	
	audioTrack.prototype.redraw = function(){
		if(this.references){ this.wave.redraw(); }
	};

	return audioTrack;
}());