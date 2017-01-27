
// Starts loop that will scroll through the page and then call cb
function scrollThroughPage(cb) {
  window.scroll(0, 0);

  var intervalId = window.setInterval(function() {
    if(window.pageYOffset < document.body.scrollHeight - window.innerHeight) {
      // Scroll down one page
      window.scroll(0, window.window.pageYOffset + window.innerHeight);
    } else {
      // Stop loop
      window.clearInterval(intervalId);
      cb();
    }
  }, 1000);
}

function processLinks() {
  var resultLinks = document.querySelectorAll(".search-result__image img");
  console.log("found", resultLinks.length, "results");

  var imageUrls = [];
  for(var i = 0; i < resultLinks.length; i++) {    
    var imageUrl = resultLinks[i].src;
    // Replace "ghost images" with null
    if(imageUrl.indexOf("data:") != -1) imageUrl = null; 

    imageUrls.push(imageUrl);

    //console.log("image url", imageUrl);
  }

  chrome.runtime.sendMessage({ message: "haveLinks", imageUrls: imageUrls, hasNextPage: !!document.querySelector("button.next") });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Got command", request.command);

  if(request.command == "gotoNextPage") {
    document.querySelector("button.next").click();
  } else if(request.command == "analyze") {
    scrollThroughPage(processLinks);
  } else if(request.command == "ping") {
    chrome.runtime.sendMessage({ message: "ping" });
  }
});

var observer = new MutationObserver(function(mutations) {
  // Send message that the search results have changed
  chrome.runtime.sendMessage({ message: "awoke" });
});

var intervalId = window.setInterval(function() {
  var searchResultsEl = document.querySelector("ul.results-list");
  if(searchResultsEl) {
    console.log("Attached observer");
    observer.observe(searchResultsEl, { childList: true });

    // Send message that the first page is ready
    chrome.runtime.sendMessage({ message: "awoke" });

    // Stop loop
    window.clearInterval(intervalId);    
  } 
}, 1000);

console.log("In Your Face content script loaded");
