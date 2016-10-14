// Get the current active tab ID 

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  var tabId = tabs[0].id;
  console.log("in temp popup tabId", tabId);

  // Create the popup, encoding the tabId in the URL
  var popupWindow = window.open(chrome.extension.getURL("popup.html") + "?tabId=" + tabId, 
    "In Your Face", "width=510,height=700");
  
  window.close(); // close the Chrome extension pop-up
});

