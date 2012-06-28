(function(Ayamel){
	"use strict";
	if(!Ayamel){
		throw new Error("Ayamel Uninitialized");
	}
	
	var getSelection = (window.getSelection || document.getSelection || document.selection.createRange),
		activeMenu = null;
		
	function TextMenu(menu){
		var element, selection;
		if(menu instanceof HTMLElement){
			element = menu;
			Object.defineProperty(this,'selection',{
				get: function(){return selection;},
				set: function(s){return selection = s;}
			});
		}else if(menu && (menu.element instanceof HTMLElement)){
			element = menu.element;
			Object.defineProperty(this,'selection',{
				get: function(){return menu.selection;},
				set: function(s){return menu.selection = s;}
			});
		}else{ throw "Menu Not Displayable"; }
		if(element.parentNode){
			element.parentNode.removeChild(element);
		}
		element.style.position = "absolute";
		Object.defineProperties(this,{
			open: {
				value: function(x,y,s){
					element.style.top = y+"px";
					element.style.left = x+"px";
					this.selection = s;
					(Ayamel.FSElement()||document.body).appendChild(element);
				},enumerable: true
			},
			close: {
				value: function(){
					element.parentNode.removeChild(element);
				},enumerable: true			
			}
		});
	}
	
	function Text(params){
		/*{
			parent: the parent element where this should be displayed
			wrapper: a function that produces a styled wrapper element
			processor: a text pre-processor, for adding annotations and stuff
			menu: the highlight menu associated with this text
			text: initial content,
		}*/
		var raw,c_el,d_el,
			menu = new TextMenu(params.menu),
			processor = (typeof params.processor === 'function')
				?params.processor
				:function(x){
					var el = document.createElement("span");
					el.innerHTML = x;
					return el.childNodes.length===1?el.firstChild:el;
				},
			wrapper = params.wrapper,
			parent = params.parent || document.body,
			text = params.text,
			displayed = false;
		
		if(!(parent instanceof HTMLElement)){throw "Invalid Parent Node";}
		
		c_el = document.createElement('span');
		d_el = (typeof wrapper == 'function')?wrapper(c_el):c_el;
		d_el.addEventListener("mouseup",function(e){
			var st = getSelection();
			activeMenu && activeMenu.close();
			if(!st.isCollapsed){
				menu.open(	document.body.scrollLeft+e.clientX,
							document.body.scrollTop+e.clientY,
							st, d_el);
				activeMenu = menu;
			}else{activeMenu = null;}
			e.stopPropagation();
			e.preventDefault();
		});
		c_el.innerHTML = "loading...";
		Object.defineProperties(this,{
			text: {
				set: (c_el === d_el)
					?function(t){
						d_el.replaceChild(processor(t),d_el.firstChild);
						return raw = t;
					}
					:function(t){
						var nn = processor(t);
						c_el.parentNode.replaceChild(nn,c_el);
						c_el = nn;
						return raw = t;
					},
				get: function(){return raw;},
				enumerable: true
			},
			displayed: {get: function(){return displayed;}},
			display: {
				value: function(p){
					var dp = (p||parent);
					if(dp != d_el.parentNode){
						this.hide();
						dp.appendChild(d_el);
					}
					displayed = true;
				},enumerable: true
			},
			hide: {
				value: function(){
					if(displayed){
						d_el.parentNode.removeChild(d_el);
						displayed = false;
						if(menu === activeMenu){
							menu.close();
							activeMenu = null;
						}
					}
				},enumerable: true
			}
		});
		
		this.el = d_el;
		if(text){this.text = text;}
	}
	
	document.addEventListener("mouseup", function(){
		if(activeMenu){
			activeMenu.close();
			activeMenu = null;
		}
	});

	Ayamel.Text = Text;
}(Ayamel));