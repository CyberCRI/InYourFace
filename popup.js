// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;

    // tab.url is only available if the "activeTab" permission is declared.
    // If you want to see the URL of other tabs (e.g. after removing active:true
    // from |queryInfo|), then the "tabs" permission is required to see their
    // "url" properties.
    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback(url);
  });

  // Most methods of the Chrome extension APIs are asynchronous. This means that
  // you CANNOT do something like this:
  //
  // var url;
  // chrome.tabs.query(queryInfo, function(tabs) {
  //   url = tabs[0].url;
  // });
  // alert(url); // Shows "undefined", because chrome.tabs.query is async.
}


function renderStatus(statusText) {
  document.getElementById('status').textContent = statusText;
}

function changeImage(url, caption) {
  document.getElementById('photo').src = url;
  document.getElementById('photo-caption').textContent = caption;
}

var currentResults = {
  male: 0,
  female: 0,
  total: 0
};

var tabId = null;

var isRunning = false;

var chart = false;

function interpretResults(results) {
  if(results.face.length == 0) return "Unknown";
  else return results.face[0].attribute.gender.value;
}

function analyzeImage(imageUrl) {
  // Get "full image" from thumbnail URL
  var fullImageUrl = imageUrl.replace("shrink_100_100/", "");
  var faceDetectUrl = "https://apius.faceplusplus.com/v2/detection/detect?api_key=" + API_KEY + "&api_secret=" + API_SECRET + "&url=" + fullImageUrl;
  return $.getJSON(faceDetectUrl).then(function(faceDetectionResults) {
    updateResults(faceDetectionResults);
    changeImage(imageUrl, interpretResults(faceDetectionResults));

    return { imageUrl: imageUrl, faceDetection: faceDetectionResults };
  });
}

function updateResults(results) {
  currentResults.total++;

  if(results.face.length == 0) return;

  if(results.face[0].attribute.gender.value == "Male") currentResults.male++;
  else currentResults.female++;

  chart.load({
   columns: [
      ['Male', currentResults.male],
      ['Female', currentResults.female]
    ]
  });
}

function runProcess() {
  if(!isRunning) return;

  chrome.tabs.sendMessage(tabId, { command: "analyze" }, function(response) {
    if(!response) {
      renderStatus("Can't find any images. Are you on a LinkedIn people search page?")

      switchRunning(false);
      return;
    }

    // Remove "ghost" images
    var imageUrls = response.imageUrls.filter(function(url) {
      return url.indexOf("ghost_person") == -1;
    });

    renderStatus("Found " + imageUrls.length + " images");

    // Request one at a time
    renderStatus("Analyzing image " + 1 + " of " + imageUrls.length);

    var promise = analyzeImage(imageUrls[0]);
    for(var i = 1; i < imageUrls.length; i++) {
      (function(i) {
        promise = promise.then(function(results) { 
          if(!isRunning) return;

          renderStatus("Analyzing image " + (i + 1) + " of " + imageUrls.length);
          return analyzeImage(imageUrls[i])
        });
      })(i);
    }

    promise.then(function(results) {
      changeImage("");

      if(response.nextPageLink && isRunning) {
        renderStatus("Next page...");
        chrome.tabs.sendMessage(tabId, { command: "goto", href: response.nextPageLink });
      } else {
        renderStatus("Done.");        
      }
    }); 
  });
}

function switchRunning(val) {
  isRunning = val;

  $("#start").prop("disabled", val);
  $("#stop").prop("disabled", !val);
}

chrome.runtime.onMessage.addListener(function(request) {
  if(request.message == "awoke") {
    if(isRunning) {
      runProcess();
    }
  }
});

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  tabId = tabs[0].id;
});

$(function() { 
  $("#start").on("click", function() {
    switchRunning(true);

    runProcess();
  });

  $("#stop").on("click", function() {
    switchRunning(false);
  });

  chart = c3.generate({
    bindto: '#chart',
    data: {
      type: 'pie',
      columns: [
        ['Male', 0],
        ['Female', 0]
      ]
    },
    pie: {
      label: {
        format: function (value, ratio, id) {
          return value + " (" + Math.floor(ratio * 100) + "%)" ; // d3.format('$')(value);
        }
      }
    }
  });
});


