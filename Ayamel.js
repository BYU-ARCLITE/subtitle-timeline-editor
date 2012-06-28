(function(global){
	"use strict";
	var fs = true,
		reqFS, exitFS, eventFS, isFS, FSEl,
		PCons = [],
		genFrame;
	
	if(!!document.mozCancelFullScreen){
		exitFS = function(){document.fullScreen && document.mozCancelFullScreen();};
		reqFS = function(el){
			el.mozRequestFullScreen();
			FSEl = el;
		};
		isFS = function(){return document.fullScreen;};
		eventFS = "mozfullscreenchange";
	}else if(!!document.webkitCancelFullScreen){
		exitFS = function(){document.webkitIsFullScreen && document.webkitCancelFullScreen();};
		reqFS = function(el){
			el.webkitRequestFullScreen();
			FSEl = el;
		};
		isFS = function(){return document.webkitIsFullScreen;};
		eventFS = "webkitfullscreenchange";
	}else{fs = false;}
	
	if(!global.Ayamel){
		genFrame = document.createElement('iframe');
		
		genFrame.style.width = "100%";
		genFrame.style.height = "100%";
		genFrame.style.position = "absolute";
		genFrame.frameBorder = "0";
		//	genFrame.sandbox = "allow-same-origin";
		genFrame.mozallowfullscreen = true;
		genFrame.seamless = true;
		
		//set up hot-key handlers
		global.addEventListener('keydown',function(e){
			var action = Ayamel.keybindings[e.key || e.keyCode];
			if(action){
				if(typeof e.repeat === 'undefined'){
					e.repeat = !!action.done;
				}
				action(e);
				action.done = true;
			}
		});
		global.addEventListener('keyup',function(e){
			var action = Ayamel.keybindings[e.key || e.keyCode];
			action && (action.done = false);
		});
		
		global.Ayamel = {
			Stage:		function(){throw "Ayamel.Stage Uninitialized";},
			Player:		function(){throw "Ayamel.Player Uninitialized";},
			Actor:		function(){throw "Ayamel.Actor Uninitialized";},
			Renderer:	function(){throw "Ayamel.Renderer Uninitialized";},
			Caption:	function(){throw "Ayamel.Caption Uninitialized";},
			Video:		function(){throw "Ayamel.Video Uninitialized";},
			Clip:		function(){throw "Ayamel.Clip Uninitialized";},
			Text:		function(){throw "Ayamel.Text Uninitialized";},
			AyamelElement: {
				get supportsFullscreen() {return fs;},
				get isFullScreen() {return document.fullScreenElement === this.element || isFS();},
				EnterFullScreen:function() {fs && reqFS(this.element);},
				LeaveFullScreen:function() {fs && exitFS();},
			},
			FSElement: function(){return isFS() && FSEl;},
			InstallPlayers:function(installers,cb){
				var done = false,
					waitcount = 0;
				installers.forEach(function(installer,index){
					waitcount--;
					installer(Ayamel,global,function(cons){
						PCons[index] = cons;
						if(++waitcount === 0 && done && cb) cb();
					});
				});
				if(waitcount===0 && cb){cb();}
				else{done = true;}
			},
			AddPlayer:function(installer,priority,cb){
				installer(Ayamel,global,function(cons){
					PCons.splice(priority,0,cons);
					cb && cb();
				});
			},
			keybindings:{},
			$cons:PCons,
			genFrame:genFrame
		};
		
		Ayamel.Actor.Dynamic = Ayamel.Actor;
		Ayamel.Actor.Static = Ayamel.Actor;
	}
}(window));