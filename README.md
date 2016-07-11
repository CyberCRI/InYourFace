# In Your Face

Analyze profile photos to glimpse who works where.


## What is it?

_In Your Face_ is an attempt to use public data to analyze diversity within the workplace. In particular, the social network LinkedIn includes a huge amount of self-published data about who works for which employer. LinkedIn does not publish demographic information such as gender, age, or ethnicity. However, we can get a glimpse of that information by analyzing profile photos. We use the [free Face++ API](http://www.faceplusplus.com/) for this purpose. 


## How does it Work?

Imagine you wanted to tally up how many men vs. how many women were on LinkedIn for a particular company. You could search on the company, then go page-by-page through the results, counting up the number of profiles with a man's face compared to the number of profiles with a woman's face. _In Your Face_ tries to automate that process.

_In Your Face_ is a browser extension for Google Chrome. It would be more practical to provide users a website, but LinkedIn does not provide a search function via their API. A browser extension allows us to examine the photos for any given search. The extensions does not store the data at any time, but merely sends off publicly-accessible image URLs to the face analysis API and tallies the results.

It's important to note that the face analysis API often makes mistakes on individual photos. However, we think that for large enough searches, the results should be representative.


## Setup

1. Clone the repository.
2. Install dependencies (`bower install`).
3. Sign up for a [Face++ API account](http://www.faceplusplus.com/uc_home/).
4. Copy the `config.sample.js` file to `config.js`. Edit the file to copy in the API key and secret from Face++. You can also change which of charts are included by editing the `CHARTS` parameter. The complete list is `["gender", "race", "age", "glasses", "smiling"]`.
5. [Load the unpacked extension into Chrome](https://developer.chrome.com/extensions/getstarted#unpacked) 

If you make changes to the code, don't forget to reload the extension (in the extensions tab) as well as reload the LinkedIn page that you are searching on.


## How to Use

Go to LinkedIn and search for any company. Look for a bunch of small profile photos on the right, and click on the "See All" link. You can make additional filters on the right.

Alternatively, you can [go directly to the search page](https://www.linkedin.com/vsearch/p) and then filter the results. This way you can also search within your own network.

Once you have your search done, press the _In Your Face_ icon and the "Start Analysis" button. You should see the photos and analysis results go by. You can press "Stop" at any point.


## Thanks 

We use the great library [C3.js](http://c3js.org/) to make the pretty charts, and the [free Face++ API](http://www.faceplusplus.com/) for face analysis.


## Important Note

The developers of this project do not have any connection with LinkedIn. Neither the developers nor the project stores any profile information coming from LinkedIn. All use of this extension is the full responsibility of the user. 
