// *** Globals

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
  smiling: {
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

var counters = {
  success: 0,
  total: 0
};

// Decode tabId from URL
var tabId = parseInt(window.location.search.match(/tabId=(\d+)/)[1]);

var status = "ready"; // values: "ready", "analyzing", "doneAnalyzing", "published", "cancelled"

var charts = {};


// *** Functions

function renderStatus(statusText) {
  document.getElementById('status').textContent = statusText;
}

function changeImage(url, caption) {
  document.getElementById('photo').src = url;
  $("#photo-caption").html(caption);
}


function interpretResults(results) {
  if(results.face.length == 0) return null;
  else return {
    gender: results.face[0].attribute.gender.value,
    race: results.face[0].attribute.race.value,
    glasses: results.face[0].attribute.glass.value != "None",
    age: results.face[0].attribute.age, // include value and range
    smiling: results.face[0].attribute.smiling.value > 50
  };
}

function makeResultsHtml(interpretedResults) {
  if(!interpretedResults) return "Analysis failed";

  var resultsHtml = "";
  CONFIG.CHARTS.forEach(function(chartName) {
    switch(chartName) {
      case "gender":
        resultsHtml += "Gender: " + interpretedResults.gender;
        break;
      case "race":
        resultsHtml += "Race: " + interpretedResults.race;
        break;
      case "age":
        resultsHtml += "Age: " + interpretedResults.age.value + " ± " + (interpretedResults.age.range / 2) + " years old";
        break;
      case "glasses":
        resultsHtml += "Glasses: " + (interpretedResults.glasses ? "Yes" : "No");
        break;
      case "smiling":
        resultsHtml += "Smiling: " + (interpretedResults.smiling ? "Yes" : "No");
        break;
    }

    resultsHtml += "<br>";
  });

  return resultsHtml;
}

function analyzeImage(imageUrl) {
  // Get "full image" from thumbnail URL
  var fullImageUrl = imageUrl.replace("shrink_100_100/", "");
  var faceDetectUrl = "https://apius.faceplusplus.com/v2/detection/detect?api_key=" + CONFIG.FACEPP_API_KEY + "&api_secret=" + CONFIG.FACEPP_API_SECRET + "&url=" + fullImageUrl + "&attribute=glass,gender,age,race,smiling";
  
  var deferred = $.Deferred();
  $.getJSON(faceDetectUrl).done(function(faceDetectionResults) {
    var interpretedResults = interpretResults(faceDetectionResults);

    changeImage(imageUrl, makeResultsHtml(interpretedResults));
    updateResults(interpretedResults);
    updateCharts();

    deferred.resolve({ imageUrl: imageUrl, faceDetection: faceDetectionResults });
  }).fail(function() {
    // Something went wrong, skip it...
    // TODO: handle concurreny errors through retry

    changeImage(imageUrl, makeResultsHtml(null));
    updateResults(null);
    updateCharts();

    deferred.resolve({ imageUrl: imageUrl, faceDetection: null });
  });

  return deferred.promise();
}

function updateResults(interpretedResults) {
  counters.total++;

  if(!interpretedResults) return;

  counters.success++;

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

  if(interpretedResults.smiling) currentResults.smiling.Yes++;
  else currentResults.smiling.No++;
}

function updateCharts() {
  CONFIG.CHARTS.forEach(function(chartName) {
    charts[chartName].load({
      columns: _.pairs(currentResults[chartName])
    });
  });

  var percent = Math.floor(100 * counters.success / counters.total);
  $("#analysis-summary").text("Analyzed " + counters.success + " photos out of " + counters.total + " profiles (" + percent + "%).");
}

function runProcess() {
  if(status != "analyzing") return;

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

    // Count skipped photos
    counters.total += response.imageUrls.length - imageUrls.length;

    renderStatus("Found " + imageUrls.length + " images");

    // Request one at a time
    renderStatus("Analyzing image " + 1 + " of " + imageUrls.length);

    var promise = analyzeImage(imageUrls[0]);
    for(var i = 1; i < imageUrls.length; i++) {
      (function(i) {
        promise = promise.then(function() { 
          if(status != "analyzing") return;

          renderStatus("Analyzing image " + (i + 1) + " of " + imageUrls.length);
          return analyzeImage(imageUrls[i])
        });
      })(i);
    }

    promise.then(function() {
      changeImage("", "");

      if(response.nextPageLink && status == "analyzing") {
        renderStatus("Next page...");
        chrome.tabs.sendMessage(tabId, { command: "goto", href: response.nextPageLink });
      } else {
        renderStatus("Done.");        
      }
    }); 
  });
}

function switchStatus(newStatus) {
  status = newStatus;

  $("#start").hide();
  $("#stop").hide();
  $("#feedback-container").hide();
  $("#feedback-thanks").hide();
  $("#chart-container").hide();
  $("#cancelled-text").hide();

  if(status == "ready") $("#start").show();    
  else if(status == "analyzing") {
    $("#stop").show();
    $("#chart-container").show();
  }    
  else if(status == "doneAnalyzing") $("#feedback-container").show();    
  else if(status == "published") $("#feedback-thanks").show();    
  else if(status == "cancelled") $("#cancelled-text").show();    
}


// *** Script

chrome.runtime.onMessage.addListener(function(request) {
  if(request.message == "awoke") {
    if(isRunning) {
      runProcess();
    }
  }
});


$(function() { 
  $("#start").on("click", function() {
    switchStatus("analyzing");

    runProcess();
  });

  $("#stop").on("click", function() {
    switchStatus("cancelled");
  });

  switchStatus("ready");

  CONFIG.CHARTS.forEach(function(chartName) {
    $("<div class='chart' id='" + chartName + "-chart'></div>").appendTo($("#chart-container"));

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


