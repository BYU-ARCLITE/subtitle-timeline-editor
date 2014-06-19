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

        if(text === null){
            focusNode = document.createTextNode('');
            anchor.appendChild(node);
            anchor.appendChild(focusNode);
        }else{
            offset = selection.anchorOffset;
            focusNode = document.createTextNode(text.substr(offset));
            frag = document.createDocumentFragment();

            //edit the caption contents
            if(offset > 0){ frag.appendChild(document.createTextNode(text.substr(0,offset))); }
            frag.appendChild(node);
            frag.appendChild(focusNode);
            anchor.parentNode.replaceChild(frag,anchor);
        }

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
            case 27: //escape key
                this.node.blur();
                break;
            case 66: // bold key
                if(e.ctrlKey){document.execCommand('bold',false,null); e.preventDefault(); }
                break;
            case 73: // italics key
                if(e.ctrlKey){document.execCommand('italic',false,null); e.preventDefault(); }
                break;
            case 85: // underline key
                if(e.ctrlKey){document.execCommand('underline',false,null); e.preventDefault(); }
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

        if(~[].indexOf.call(ClipBoard.types,'text/html')){
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
            renderedCue.typeInfo.attachEditor(renderedCue, {
                //registerAttrChange: function(){ ... }
                registerInput: editorInput.bind(editor,renderedCue),
                getSelectedContent: function(){
                    var selection = getSelection();
                    return (selection.type === "Range" && renderedCue.node.contains(selection.focusNode))?
                        selection.getRangeAt(0).cloneContents():document.createDocumentFragment();
                },
                replaceSelection: function(node){
                    if(!renderedCue.node.contains(getSelection().focusNode)){ return false; }
                    replaceSelectionWith(node);
                    return true;
                }
            })
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

    function isFocusEditable(){
        var node = getSelection().focusNode;
        while(node !== null){
            if(node.nodeType === Node.ELEMENT_NODE){
                if(node.contentEditable === "true"){ return true; }
                if(node.tagName === 'input'){ return true; }
                if(node.tagName === 'textarea'){ return true; }
            }
            node = node.parentNode;
        }
        return false;
    }

    function autoFocus(renderedCue){
        var observer, fn, node = renderedCue.node;
        if(isFocusEditable()){ return; }
        fn = function(){ observer.disconnect(); };
        observer = new MutationObserver(function(mutations) {
            var selection, range;
            if(mutations.some(function(record){
                return record.type !== 'childList'?false:
                    record.addedNodes === null?false:
                    [].indexOf.call(record.addedNodes,node) !== -1;
            })){
                range = document.createRange();
                range.selectNodeContents(node);
                range.collapse(false); //false moves to the end instead of the beginning

                selection = getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                node.focus();
                observer.disconnect();
                renderedCue.removeFinalizer(fn);
            }
        });
        observer.observe(renderedCue.renderer.appendCueCanvasTo,{childList:true,subtree:true});
        renderedCue.addFinalizer(fn);
    }

    CaptionEditor.prototype.make = function(renderedCue,area,defRender){
        if(renderedCue.editable){
            if(renderedCue.done){
                if(!renderedCue.dirty){ return; }
                renderedCue.cleanup();
            }
            defRender();
            if(renderedCue.node){
                makeEditable(renderedCue,this);
                setTimeout(function(){autoFocus(renderedCue);},50);
            }
        }else{ defRender(); }
    };

    return CaptionEditor;
}());