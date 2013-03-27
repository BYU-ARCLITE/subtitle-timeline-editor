(function(Timeline){
	"use strict";
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	Timeline.MainMenu = [
		{label:"Editing",submenu:[
			{label:"Undo",
				condition:function(){return this.timeline.cstack.undoDepth > 0; },
				action:function(){ this.timeline.cstack.undo(); }},
			{label:"Redo",
				condition:function(){return this.timeline.cstack.redoDepth > 0; },
				action:function(){ this.timeline.cstack.redo(); }},
			{label:"Tools",submenu:[
				{label:"Select",action:function(){ this.timeline.currentTool = Timeline.SELECT; }},
				{label:"Move",action:function(){ this.timeline.currentTool = Timeline.MOVE; }},
				{label:"Add",action:function(){ this.timeline.currentTool = Timeline.CREATE; }},
				{label:"Split",action:function(){ this.timeline.currentTool = Timeline.SPLIT; }},
				{label:"Delete",action:function(){ this.timeline.currentTool = Timeline.DELETE; }},
				{label:"Shift",action:function(){ this.timeline.currentTool = Timeline.SHIFT; }}
			]}
		]},
		{label:"Navigation",submenu:[
			{label:"Repeat Tool",action:function(){ this.timeline.currentTool = Timeline.REPEAT; }},
			{label:"Scroll Tool",action:function(){ this.timeline.currentTool = Timeline.ORDER; }},
			{label:"Order Tool",action:function(){ this.timeline.currentTool = Timeline.ORDER; }},
			{label:"Zoom In",action:function(pos){
				this.view.startTime += (this.timeline.view.pixelToTime(pos.x)-this.view.startTime)/2;
				this.view.endTime += (this.timeline.view.pixelToTime(pos.x)-this.view.endTime)/2;
				this.render();
			}},
			{label:"Zoom Out",action:function(pos){
				this.view.startTime -= (this.timeline.view.pixelToTime(pos.x)-this.view.startTime)/2;
				this.view.endTime -= (this.timeline.view.pixelToTime(pos.x)-this.view.endTime)/2;
				this.render();
			}}
		]},
		{label:"AB Repeat",submenu:[
			{label:"Enable",
				condition:function(){return this.timeline.abRepeatSet && !this.timeline.abRepeatOn; },
				action:function(){ this.timeline.abRepeatOn = true; }},
			{label:"Disable",
				condition:function(){return this.timeline.abRepeatOn; },
				action:function(){ this.timeline.abRepeatOn = false; }},
			{label:"Clear",
				condition:function(){return this.timeline.abRepeatSet; },
				action:function(){ this.timeline.clearRepeat(); }},
			{label:"Set Repeat Point",action:function(pos){
				(this.timeline.abRepeatSet?updateABPoints:resetABPoints).call(this.timeline,pos);
			}}
		]}
	];
	
	Timeline.TrackMenu = [
		{label:"Merge Selected",
			condition:function(){ return !this.track.locked; },
			action:function(){ this.track.mergeSelected(); }},
		{label:"Lock",
			condition:function(){ return !this.track.locked; },
			action:function(){ this.track.locked = true; }},
		{label:"Unlock",
			condition:function(){ return this.track.locked; },
			action:function(){ this.track.locked = false; }},
		{label:"Remove",
			action:function(){
				var track = this.track;
				if(!confirm("Are You Sure You Want To Remove "+track.id+"?")){ return; }
				this.timeline.removeTextTrack(track.id);
			}},
		{label:"Set Audio",
			condition: function(){ return Reader && WaveForm && Resampler && !this.track.locked; },
			submenu: {
				forEach: function(f,that){
					[{label: "From Disk",
						action: function(){
							var tl = this.timeline,
								track = this.track,
								f = document.createElement('input');
							f.type = "file";
							f.addEventListener('change',function(evt){
								var file = evt.target.files[0];
								addWaveToTimeline.call(tl,Reader.fromFile(file),file.name,track);
							});
							f.click();	
						}
					},{label: "From URL",
						action: function(){
							var tl = this,
								url = prompt("URL of Audio File:","http://"),
								name_match = /\/([^\/]+)$/.exec(url);
							addWaveToTimeline.call(
								tl,
								Reader.fromURL(url),
								name_match[1],
								this.track
							);
						}
					},{label: "None",
						condition: function(){ return !!this.track.audioId; },
						action: function(){ this.timeline.unsetAudioTrack(this.track.id); }
					}].forEach(f,that);
					Object.keys(that.timeline.audio).forEach(function(key){
						f.call(that,(that.track.audioId === key?
							{label: "<i>"+key+"</i>"}:
							{label: key,
								action: function(){ this.timeline.setAudioTrack(this.track.id,key); }}));
					});
				}
			}}
	];
	
	/** Audio Functions **/
	
	function addWaveToTimeline(reader,name,track){
		var tl = this,
			rate = 1001,
			wave = new WaveForm(
				this.width,
				this.trackHeight,
				1/*channels*/,rate
			);
		
		this.addAudioTrack(wave,name);
		this.setAudioTrack(track.id,name);
		console.log("Initializing Audio Decoder");
		initAudioReader(reader,10000/*bufsize*/,rate,wave);
	}
	
	function initAudioReader(reader,bufsize,rate,wave) {
		var chan, frame, buffer, channels, resampler;
		reader.on('format', function(data) {
			resampler = new Resampler(data.sampleRate,rate,1);
			channels = data.channelsPerFrame;
			bufsize -= bufsize%channels;
			buffer = new Float32Array(bufsize);
			chan = buffer.subarray(0,bufsize/channels);
			frame = new Float32Array(Math.ceil(bufsize*rate/(data.sampleRate*channels)));
		});
		reader.on('ready', function(){
			var startTime = Date.now(),
				repeat = setInterval(function(){
				var i, j;
				if(reader.get(buffer) !== 'filled'){
					clearInterval(repeat);
				}else{
					//deinterlace:
					for(i=0,j=0;j<bufsize;j+=channels){
						chan[i++] = buffer[j];
					}
					resampler.exec(chan,frame);
					wave.addFrame(frame); //addFrame emits redraw
				}
			},1);
		});
		reader.start();
	}
	
	Timeline.SegMenu = [
		{label:"Select",
			condition:function(){ return !this.segment.selected; },
			action:function(){ this.segment.select(); }},
		{label:"Unselect",
			condition:function(){ return this.segment.selected; },
			action:function(){ this.segment.unselect(); }},
		{label:"Split", action:function(pos){ this.segment.split(pos); }},
		{label:"Delete", action:function(){ this.segment.del(); }},
		{label:"Match Repeat",
			condition:function(pos){ return this.timeline.abRepeatSet; },
			action:function(pos){
				var tl = this.timeline;
				this.segment(pos).move(tl.repeatA,tl.repeatB);
			}}
	];
	
}(Timeline));