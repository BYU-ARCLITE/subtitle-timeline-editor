var captionWrapper = (function(){
	var shell = document.createElement('div'),
		tstyle = document.createElement('span'),
		bg	= document.createElement('span');
	
	with(shell.style){
		position = "relative";
		width = "auto";
		display = "inline-block";
		overflow = "hidden";
	}
	with(tstyle.style){
		position = "relative";
		width = "auto";
		color = "white";
	}
	with(bg.style){
		position = "absolute";
		top = 0;
		bottom = 0;
		left = 0;
		right = 0;
		border = "1px solid black";
		background = "rgba(0,0,0,.5)";
		opacity = .5;
	}
	
	return function(el){
		var s = shell.cloneNode(false),
			w = tstyle.cloneNode(false);
		s.appendChild(bg.cloneNode(false));
		w.appendChild(el);
		s.appendChild(w);
		return s;
	}
}());