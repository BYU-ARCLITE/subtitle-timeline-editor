var SRT = (function(){
	"use strict";
	function SRTtime(time){
		var seconds = Math.floor(time),
			minutes = Math.floor(seconds/60),
			hh,mm,ss,ms;
		hh = Math.floor(minutes/60);
		mm = (minutes%60);
		ss = (seconds%60);
		ms = Math.floor(1000*(time-seconds));
		return (hh>9?hh:"0"+hh)+":"
				+(mm>9?mm:"0"+mm)+":"
				+(ss>9?ss:"0"+ss)+","
				+(ms>99?ms:(ms>9?"0"+ms:"00"+ms));
	}
	
	function serialize(cue){
		return (parseInt(cue.id,10)||"0")+"\n"
			+SRTtime(cue.startTime)+" --> "+SRTtime(cue.endTime)
			+"\n"+cue.text+"\n\n";
	}
		
	return {
		parse: function(){ throw new Error("SRT Parsing Not Implemented"); },
		serialize: serialize
	};
}());