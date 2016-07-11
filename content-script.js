//console.log("Content script loaded");

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Got command", request.command);

  if(request.command == "goto") {
    window.document.location.href = request.href;
  } else if(request.command == "analyze") {
    var resultLinks = document.getElementsByClassName("result-image");
    console.log("found", resultLinks.length, "results");

    var nextPageLink = document.querySelector(".next a");
    if(nextPageLink) nextPageLink = nextPageLink.href;

    var imageUrls = [];
    for(var i = 0; i < resultLinks.length; i++) {
      var imageUrl = resultLinks[i].childNodes[0].src;
      imageUrls.push(imageUrl);

      //console.log("image url", imageUrl);
    }

    sendResponse({ imageUrls: imageUrls, nextPageLink: nextPageLink });
  }
});

chrome.runtime.sendMessage({ message: "awoke" });
//console.log("Send awoke message");
