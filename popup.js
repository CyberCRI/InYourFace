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

function changeImage(url) {
  document.getElementById('photo').src = url;
}

function renderResults() {
  document.getElementById('male-count').innerText = currentResults.male;
  document.getElementById('female-count').innerText = currentResults.female;
  document.getElementById('total-count').innerText = currentResults.total;
}

var API_KEY = "ea50f2be9a7fe2c72da17081fc78af9e";
var API_SECRET = "fUee4SrXxNb1KRC_0acJjZDChxhQ7f7t";

var currentResults = {
  male: 0,
  female: 0,
  total: 0
};

var tabId = null;


function analyzeImage(imageUrl) {
  // TODO: convert thumbnail to full image
  var faceDetectUrl = "https://apius.faceplusplus.com/v2/detection/detect?api_key=" + API_KEY + "&api_secret=" + API_SECRET + "&url=" + imageUrl;
  return $.getJSON(faceDetectUrl);
}

function updateResults(results) {
  currentResults.total++;

  if(results.face.length == 0) return;

  if(results.face[0].attribute.gender.value == "Male") currentResults.male++;
  else currentResults.female++;
}

function runProcess() {
  chrome.tabs.sendMessage(tabId, { command: "analyze" }, function(response) {
    // Remove "ghost" images
    var imageUrls = response.imageUrls.filter(function(url) {
      return url.indexOf("ghost_person") == -1;
    });

    renderStatus("Found " + imageUrls.length + " images");

    // Request one at a time
    var promise = analyzeImage(imageUrls[0]);
    for(var i = 1; i < imageUrls.length; i++) {
      (function(i) {
        promise = promise.then(function(results) { 
          updateResults(results);
          renderResults();
          renderStatus("analyzing image " + i + " of " + imageUrls.length);
          changeImage(imageUrls[i]);
          return analyzeImage(imageUrls[i])
        });
      })(i);
    }

    promise.then(function(results) {
      console.log("analysis done"); 
      updateResults(results);
      renderResults();
      changeImage("");

      if(response.nextPageLink) {
        renderStatus("Next page...");
        chrome.tabs.sendMessage(tabId, { command: "goto", href: response.nextPageLink });
      }
    }); 
  });
}

chrome.runtime.onMessage.addListener(function(request) {
  if(request.message == "awoke") {
    runProcess();
  }
});

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  tabId = tabs[0].id;

  runProcess();
});

