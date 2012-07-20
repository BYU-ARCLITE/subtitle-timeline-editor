(function(Timeline){
	"use strict";
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Fonts(obj){
		this.keyFontStyle = obj.keyFontStyle || "italic";
		this.keyFontSize = obj.keyFontSize || 14;
		this.keyFontFace = obj.keyFontFace || "sans-serif";
		this.keyTextColor = obj.keyTextColor || "#fff";
		
		this.titleFontStyle = obj.titleFontStyle || "italic";
		this.titleFontSize = obj.titleFontSize || 14;
		this.titleFontFace = obj.titleFontFace || "sans-serif";
		this.titleTextColor = obj.titleTextColor || "#ddd";
		
		this.segmentFontStyle = obj.segmentFontStyle || "";
		this.segmentFontSize = obj.segmentFontSize || 20;
		this.segmentFontFace = obj.segmentFontFace || "sans-serif";
		this.segmentTextColor = obj.segmentTextColor || "#000";
		
		this.idFontStyle = obj.idFontStyle || "italic";
		this.idFontSize = obj.idFontSize || 10;
		this.idFontFace = obj.idFontFace || "sans-serif";
		this.idTextColor = obj.idTextColor || "#ddd";
		
		Object.defineProperties(this,{
			keyFont: {get:function(){return this.keyFontStyle+" "+this.keyFontSize+"px "+this.keyFontFace;},enumerable:true},
			titleFont: {get:function(){return this.titleFontStyle+" "+this.titleFontSize+"px "+this.titleFontFace;},enumerable:true},
			segmentFont: {get:function(){return this.segmentFontStyle+" "+this.segmentFontSize+"px "+this.segmentFontFace;},enumerable:true},
			idFont: {get:function(){return this.idFontStyle+" "+this.idFontSize+"px "+this.idFontFace;},enumerable:true}
		});
		
		Object.freeze(this);
	}
	
	Timeline.Fonts = Fonts;
	
	function Colors(obj){
		this.bgMid = obj.bgMid || "#3e3f43";
		this.bgTop = obj.bgTop || "#292a2d";
		this.bgBottom = obj.bgBottom || "#292a2d";
		this.placeholder = obj.placeholder || "rgba(255, 255, 160, 0.5)";
		this.timeMarker = obj.timeMarker || "rgba(255, 255, 160, 0.5)";
		this.abRepeat = obj.abRepeat || "rgba(255, 0, 0, 0.4)";
		this.abRepeatLight = obj.abRepeatLight || "rgba(255, 0, 0, 0.25)";
		Object.freeze(this);
	}
	
	Timeline.Colors = Colors;
	
	function genImage(url){
		var img = new Image;
		img.src = url;
		return img;
	}
	
	var defaultImages = {
		// normal images
		segmentLeft: genImage("./images/event_left.png"),
		segmentRight: genImage("./images/event_right.png"),
		segmentMid: genImage("./images/event_mid.png"),
		// selected images
		segmentLeftSel: genImage("./images/event_left_sel.png"),
		segmentRightSel: genImage("./images/event_right_sel.png"),
		segmentMidSel: genImage("./images/event_mid_sel.png"),
		// dark images
		segmentLeftDark: genImage("./images/event_left_dark.png"),
		segmentRightDark: genImage("./images/event_right_dark.png"),
		segmentMidDark: genImage("./images/event_mid_dark.png"),
		// slider images
		sliderLeft: genImage("./images/slider_left.png"),
		sliderRight: genImage("./images/slider_right.png"),
		sliderMid: genImage("./images/slider_mid.png"),
		// track images
		trackBg: genImage("./images/track_bg.png")
	};
	function Images(obj){
		var img, iname;
		for(iname in defaultImages){
			this[iname] = (obj[iname] instanceof Image)?obj[iname]:defaultImages[iname];
		}
		Object.freeze(this);
	}
	
	Object.defineProperty(Images.prototype,'complete',{
		get: function(){
			var iname;
			for(iname in defaultImages){ if(!this[iname].complete){ return false; } }
			return true;
		},enumerable:true
	});
	
	Timeline.Images = Images;
	
	function Cursors(obj){
		this.pointer = obj.pointer || "url(\"./images/cursors/cursor.png\"), auto";
		this.resizeR = obj.resizeR || "url(\"./images/cursors/resize-right.png\") 10 15, col-resize";
		this.resizeL = obj.resizeL || "url(\"./images/cursors/resize-left.png\") 22 15, col-resize";
		this.move = obj.move || "url(\"./images/cursors/move.png\") 15 15, move";
		this.skip = obj.skip || "url(\"./images/cursors/skip.png\") 1 5, auto";
		this.repeatA = obj.repeatA || "url(\"./images/cursors/repeat-a.png\"), auto";
		this.repeatB = obj.repeatB || "url(\"./images/cursors/repeat-b.png\"), auto";
		this.add = obj.add || "url(\"./images/cursors/add.png\"), auto";
		this.select = obj.select || "url(\"./images/cursors/cursor-highlight.png\"), auto";
		this.remove = obj.remove || "url(\"./images/cursors/delete.png\") 15 15, pointer";
		this.locked = obj.locked || "not-allowed";
		Object.freeze(this);
	}
	
	Timeline.Cursors = Cursors;
}(Timeline));