var buttonController = {
  currentTool: 1,

  selectAction: function() {
    alert("TODO: Implement selectAction");
  }, 
  moveAction: function() {
    alert("TODO: Implement moveAction");
  },
  deleteAction: function() {
    alert("TODO: Implement addAction");
  },
  
  updateCurrentTool: function(tool) {
    buttonController.currentTool = tool;
    
    // TODO: Update the cursor
    timelineGlobal.updateCursor();
  }
}

