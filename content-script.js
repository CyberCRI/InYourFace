console.log("Content script loaded");

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Got command", request.command);

  var resultLinks = document.getElementsByClassName("result-image");
  console.log("found", resultLinks.length, "results");

  var imageUrls = [];
  for(var i = 0; i < resultLinks.length; i++) {
    var imageUrl = resultLinks[i].childNodes[0].src;
    imageUrls.push(imageUrl);

    // TODO: convert URL to get rid of shrink
    // TODO: ignore "ghosts"

    console.log("image url", imageUrl);
  }

  sendResponse({ imageUrls: imageUrls });
});



