function TimelineToolbar() {
  this.buttons = new Array();
  this.tl = null;
  
  this.render = function() {
    this.tl.canvasContext.fillStyle = this.tl.buttonColor;
    var top = this.tl.height - this.tl.toolbarHeight + this.tl.buttonSpacing;
    for(var i in this.buttons) {
      var left = i * (this.tl.buttonWidth + this.tl.buttonSpacing) + this.tl.buttonSpacing;
      this.tl.canvasContext.fillRect(left, top, this.tl.buttonWidth, this.tl.buttonHeight);
    }
  }
  
  this.init = function() {
    this.tl = timelineGlobal; // shorthand
    
    // Button Definition
    this.buttons.push(new Button("select", 0, buttonActions.selectAction));
    this.buttons.push(new Button("move", 1, buttonActions.moveAction));
    this.buttons.push(new Button("delete", 2, buttonActions.deleteAction));
  }
}