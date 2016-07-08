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
  $("#photo-caption").html(caption);
}

var CHARTS = ["gender", "race", "age", "glasses"];

var currentResults = {
  gender: {
    Male: 0,
    Female: 0
  },
  race: { },
  glasses: {
    Yes: 0,
    No: 0
  },
  age: {
    "Below 20": 0,
    "20s": 0,
    "30s": 0,
    "40s": 0,
    "50s": 0,
    "60 and up": 0
  }
};

var tabId = null;

var isRunning = false;

var charts = {};

function interpretResults(results) {
  if(results.face.length == 0) return null;
  else return {
    gender: results.face[0].attribute.gender.value,
    race: results.face[0].attribute.race.value,
    glasses: results.face[0].attribute.glass.value != "None",
    age: results.face[0].attribute.age // include value and range
  };
}

function makeResultsHtml(interpretedResults) {
  if(!interpretedResults) return "Analysis failed";

  return "Gender: " + interpretedResults.gender + "<br>" 
    + "Race: " + interpretedResults.race + "<br>"
    + "Glasses: " + (interpretedResults.glasses ? "Yes" : "No") + "<br>"
    + "Age: " + interpretedResults.age.value + " ± " + (interpretedResults.age.range / 2) + " years old";  
}

function analyzeImage(imageUrl) {
  // Get "full image" from thumbnail URL
  var fullImageUrl = imageUrl.replace("shrink_100_100/", "");
  var faceDetectUrl = "https://apius.faceplusplus.com/v2/detection/detect?api_key=" + API_KEY + "&api_secret=" + API_SECRET + "&url=" + fullImageUrl + "&attribute=glass,gender,age,race,smiling";
  return $.getJSON(faceDetectUrl).then(function(faceDetectionResults) {
    var interpretedResults = interpretResults(faceDetectionResults);

    changeImage(imageUrl, makeResultsHtml(interpretedResults));
    updateResults(interpretedResults);
    updateCharts();

    return { imageUrl: imageUrl, faceDetection: faceDetectionResults };
  });
}

function updateResults(interpretedResults) {
  if(!interpretedResults) return;

  if(interpretedResults.gender == "Male") currentResults.gender.Male++;
  else currentResults.gender.Female++;

  if(currentResults.race[interpretedResults.race]) currentResults.race[interpretedResults.race]++;
  else currentResults.race[interpretedResults.race] = 1;

  if(interpretedResults.glasses) currentResults.glasses.Yes++;
  else currentResults.glasses.No++;

  if(interpretedResults.age.value < 20) currentResults.age["Below 20"]++;
  else if(interpretedResults.age.value < 30) currentResults.age["20s"]++;
  else if(interpretedResults.age.value < 40) currentResults.age["30s"]++;
  else if(interpretedResults.age.value < 50) currentResults.age["40s"]++;
  else if(interpretedResults.age.value < 60) currentResults.age["50s"]++;
  else currentResults.age["60 and up"]++;
}

function updateCharts() {
  CHARTS.forEach(function(chartName) {
    charts[chartName].load({
      columns: _.pairs(currentResults[chartName])
    });
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
      changeImage("", "");

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

  CHARTS.forEach(function(chartName) {
    charts[chartName] = c3.generate({
      bindto: "#" + chartName + "-chart",
      size: {
        width: 200
      },
      data: {
        type: 'donut',
        columns: []
      },
      donut: {
        title: chartName[0].toUpperCase() + chartName.slice(1) // uppercase the first letter
      }
    });
  });
});


