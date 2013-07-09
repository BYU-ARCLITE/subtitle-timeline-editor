var CaptionEditor = (function(){
	function genTextChange(text, editor){
		return function(){
			this.text = text;
			//can't just refresh layout 'cause it won't update text
			//can't update texts ourselves 'cause we'll leak nodes
			editor.rebuild(this);
		};
	}

	function CaptionEditor(params){
		if(!(this instanceof CaptionEditor)){ return new CaptionEditor(params); }
		var timeline = params.timeline instanceof Timeline ? params.timeline : null;
		this.renderer = params.renderer instanceof TimedText.CaptionRenderer ? params.renderer : null;
		this.timeline = timeline;
		this.commandStack = timeline ? timeline.commandStack :
							params.stack instanceof EditorWidgets.CommandStack ? params.stack :
							null;
	}
	
	CaptionEditor.prototype.refresh = function(cue){
		if(this.renderer && cue.active){ this.renderer.refreshLayout(); }
		if(this.timeline && this.timeline.spanInView(cue.startTime, cue.endTime)){ this.timeline.render(); }
	};
	
	CaptionEditor.prototype.rebuild = function(cue){
		if(this.renderer && cue.active){ this.renderer.rebuildCaptions(); }
		if(this.timeline && this.timeline.spanInView(cue.startTime, cue.endTime)){ this.timeline.render(); }
	};
	
	//Called in the context of a CaptionEditor
	function editorInput(renderedCue){
		var cue = renderedCue.cue,
			oldtext = cue.text,
			newtext = renderedCue.typeInfo.textFromHTML(renderedCue.node);
		
		if(oldtext === newtext){ return; }
		
		if(this.commandStack){
			this.commandStack.push({
				context: cue,
				file: cue.track.label,
				redo: genTextChange(newtext,this),
				undo: genTextChange(oldtext,this)
			});
		}
		
		cue.text = newtext;
		renderedCue.updateContent();
		this.refresh(cue); //refresh, don't rebuild, 'cause we'd lose the cursor context
	}
	
	function replaceSelectionWith(node){
		var anchor, text, offset, frag,
			focusNode, range, selection = getSelection();
		
		if(!selection.isCollapsed){ selection.getRangeAt(0).deleteContents(); }
		
		anchor = selection.anchorNode;
		text = anchor.nodeValue;
		offset = selection.anchorOffset;
		
		//edit the caption contents
		frag = document.createDocumentFragment();
		if(offset > 0){ frag.appendChild(document.createTextNode(text.substr(0,offset))); }
		frag.appendChild(node);
		focusNode = document.createTextNode(text.substr(offset));
		frag.appendChild(focusNode);
		anchor.parentNode.replaceChild(frag,anchor);
		
		//reset the caret
		range = document.createRange();
		range.setStart(focusNode,0);
		range.setEnd(focusNode,0);
		selection.removeAllRanges();
		selection.addRange(range);
	}
	
	//Called in the context of a RenderedCue
	function editorKeyDown(editor,e){
		switch(e.keyCode){
			case 13: //enter key, which must be dealt with safely for contenteditable does terrible default things
				replaceSelectionWith(document.createElement('br'));
				editorInput.call(editor,this);
				
				e.preventDefault();
				e.stopPropagation();
				break;
			case 89: //undo and redo keys
			case 90:
				if(e.ctrlKey){ e.preventDefault(); }
				break;
			default:
				e.stopPropagation(); //space key, and any other keys that might be hot-keys for other stuff
				break;
		}
	}
	
	//Called in the context of a RenderedCue
	function filterPasteData(editor,e){
		var tmp, frag, format,
			ClipBoard = e.clipboardData;
		
		e.preventDefault();
		e.stopPropagation();
		
		if(~ClipBoard.types.indexOf('text/html')){
			tmp = document.createElement('div');
			tmp.innerHTML = ClipBoard.getData('text/html');
			frag = document.createDocumentFragment();
			format = this.typeInfo.formatHTML;
			[].slice.call(tmp.childNodes).forEach(function(node){
				var nnode = format(node);
				if(nnode){ frag.appendChild(nnode); }
			});
		}else{
			frag = document.createTextNode(ClipBoard.getData('text/plain'));
		}
		
		replaceSelectionWith(frag);
		editorInput.call(editor,this);
	}
	
	//Called in the context of a RenderedCue
	function onInput(editor,e){
		e.stopPropagation();
		editorInput.call(editor,this);
	}
	
	function cancelEvent(e){
		e.stopPropagation();
	}
	
	function makeEditable(renderedCue,editor){
		var node;
		
		if(typeof renderedCue.typeInfo.attachEditor === 'function'){
			renderedCue.typeInfo.attachEditor(renderedCue, editorInput.bind(renderedCue,editor));
		}
		
		node = renderedCue.node;
		node.contentEditable = 'true'; 
		node.style.border = "1px solid silver";
		node.addEventListener('input',onInput.bind(renderedCue,editor),false);
		node.addEventListener('paste',filterPasteData.bind(renderedCue,editor),false);
		node.addEventListener('keydown',editorKeyDown.bind(renderedCue,editor),false);
		node.addEventListener('keyup',cancelEvent,false);
		node.addEventListener('keypress',cancelEvent,false);
	}
	
	CaptionEditor.prototype.make = function(renderedCue,area,defRender){
		if(renderedCue.editable){
			if(renderedCue.done){
				if(renderedCue.dirty){
					renderedCue.cleanup();
				}else{ return; }
			}
			defRender();
			makeEditable(renderedCue,this);
		}else{ defRender(); }
	};
	
	return CaptionEditor;
}());