(ns website.core
  (:require-macros [cljs.core.async.macros :refer [go go-loop]])
  (:require [rum.core :as rum]
            [bidi.bidi :as bidi]
            [accountant.core :as accountant]
            [clojure.string :as string]
            [cljs.core.async :refer [<! >! put! chan]]
            [cljsjs.c3]
            [cljsjs.moment]))

(enable-console-print!)

;; define your app data so that it doesn't get over-written on reload

; (defonce app-state (atom {:text "Hello world!"}))

; TODO : move to config file
(def connection-options {"baseUrl" "http://localhost:5050"})

(def search-filter {"entityType" "event" 
                    "gameVersion" "bc02efcb-a95c-433d-bbc9-c2aa83f795c4"
                    "eventType" "results"
                    "orderBy" "serverTime:desc"})

(defn list-results [pageNumber]
  (let [promise-chan (chan 1)
        search-options (assoc search-filter "pageNumber" pageNumber)] 
    (-> 
      (.executeQuery js/redmetrics (clj->js connection-options) (clj->js search-options))
      (.then (fn [result] (put! promise-chan (js->clj result)))))
    promise-chan))

(defn get-result [result-id]
  (let [promise-chan (chan 1)
        search-filter (assoc search-filter "player" result-id)]
    (-> 
      (.executeQuery js/redmetrics (clj->js connection-options) (clj->js search-filter))
      (.then (fn [result] (put! promise-chan (-> (js->clj result) 
                                                 (get "data") 
                                                 first)))))
    promise-chan))

(defn as-percent [fraction] (str (int (* fraction 100)) "%"))

; Adapted from cljs-http (https://crossclj.info/ns/cljs-http/0.1.42/cljs-http.client.cljs.html#_parse-url)
(defn parse-query-params
  "Parse `s` as query params and return a hash map."
  [url]
  (let [[_ query-string] (string/split url #"\?")]
    (if-not (string/blank? query-string)
      (reduce
       #(let [[k v] (string/split %2 #"=")]
          (assoc %1
            (keyword (js/decodeURIComponent k))
            (js/decodeURIComponent v)))
       {} (string/split query-string #"&")))))


; Components

(rum/defcs c3-chart < 
           rum/static
           {:did-mount (fn [state] 
                         (let [element (rum/dom-node state)
                              [title columns] (-> state :rum/args)]
                           (.generate js/c3 (clj->js {"bindto" element
                                                      "size" { "width" 200 }
                                                      "data" {"type" "donut" 
                                                              "columns" columns}
                                                      "donut" {"title" title}})))
                         state)}
           [state title columns]
           [:div.chart])

(rum/defc single-result < rum/static [result]
  [:div
    [:h3 (str "By " (get-in result ["customData" "name"]))]
    [:h4.message (get-in result ["customData" "message"])]
    (let [males (get-in result ["customData" "results" "gender" "Male"])
          females (get-in result ["customData" "results" "gender" "Female"])]
      [:div.result-container 
        (c3-chart "Gender" [["Female" females] ["Male" males]])
        [:table.results
          [:tr 
            [:th "Females"]
            [:td females]]
          [:tr 
            [:th "Males"]
            [:td males]]
          [:tr 
            [:th "Total"]
            [:td (+ males females)]]]])
    (let [yes (get-in result ["customData" "results" "glasses" "Yes"])
          no (get-in result ["customData" "results" "glasses" "No"])]
      [:div.result-container 
        (c3-chart "Glasses" [["Yes" yes] ["No" no]])
        [:table.results
          [:tr 
            [:th "With glasses"]
            [:td yes]]
          [:tr 
            [:th "No glasses"]
            [:td no]]
          [:tr 
            [:th "Total"]
            [:td (+ yes no)]]]])
    (let [time (js/moment (get-in result ["serverTime"]))]
      [:p (str "Published " (.fromNow time) " on " (.format time "MMMM Do YYYY, HH:mm") ".")])
    (let [success (get-in result ["customData" "counters" "success"])
          total (get-in result ["customData" "counters" "total"])
          fraction (/ success total)]
      [:p (str "Analyzed " success " out of " total " photos (" (as-percent fraction) ").")])
])

(rum/defc single-result-short < rum/static [result]
  [:div.single-result-short
    [:h3 (str "By " (get-in result ["customData" "name"]))]
    [:h4.message (get-in result ["customData" "message"])]
    (let [time (js/moment (get-in result ["serverTime"]))]
      [:p (str "Published " (.fromNow time) " on " (.format time "MMMM Do YYYY, HH:mm") ".")])
    (let [success (get-in result ["customData" "counters" "success"])
          total (get-in result ["customData" "counters" "total"])
          fraction (/ success total)]
      [:p (str "Analyzed " success " out of " total " photos (" (as-percent fraction) ").")])])


; Pages

(rum/defc header < rum/static [] [:a {:href "/"} [:h1 "In Your Face"]])

(rum/defcs home-page < 
           rum/static 
           (rum/local nil :results)
           { :will-mount (fn [state]
                          (go (reset! (:results state) (<! (list-results (-> state :rum/args first)))))
                          state) }
  [state page-number]
  (let [results-atom (:results state)]
    [:div
      (header)
      (if (nil? @results-atom)
        [:p "Loading..."]
        [:div 
          [:p (str "Found " (get @results-atom "totalCount") " results")]
          (for [result (get @results-atom "data")]
            [:div 
              (single-result-short result)
              [:a {:href (str "/result/" (get result "player"))} "See detailed results..."]])
          [:p
           (when (.hasPreviousPage js/redmetrics @results-atom)
             [:a {:href (str "?page=" (dec (get @results-atom "pageNumber")))} "Previous page"])
           [:span " - "]
           (when (.hasNextPage js/redmetrics @results-atom)
             [:a {:href (str "?page=" (inc (get @results-atom "pageNumber")))} "Next page"])]])])) 
    
(rum/defcs single-result-page < 
           rum/static 
           (rum/local nil :result)
           { :will-mount (fn [state]
                           (let [result-id (-> state :rum/args first)]
                            (go (reset! (:result state) (<! (get-result result-id)))))
                          state) }
  [state result-id]
  (let [result-atom (:result state)]
    [:div
      (header)
      (if (nil? @result-atom)
        [:h2 "Loading..."]
        (single-result @result-atom))]))

(rum/defc error-page []
    [:h1 "Error: no such page"])


; Routing
(def app-routes ["/" {"" :home-page
                      ["result/" :result-id] :single-result-page}])

(defn path-exists? [path]
  (boolean (bidi/match-route app-routes path)))

(defn nav-handler [path]  
  (let [{:keys [handler route-params]} (bidi/match-route app-routes path)
        query-params (parse-query-params path) 
        ; Here we manually unpack the route parameters and make components. There must be a better way!
        component (condp = handler
                   :home-page (home-page (or (:page query-params) 1))
                   :single-result-page (single-result-page (:result-id route-params))
                   nil (error-page))]
    (rum/mount component
               (. js/document (getElementById "app")))))
  

 (defn init! []
  (accountant/configure-navigation! {:nav-handler nav-handler :path-exists? path-exists?})
  (accountant/dispatch-current!)) 

(init!)

(defn on-js-reload []
  ;; optionally touch your app-state to force rerendering depending on
  ;; your application
  ;; (swap! app-state update-in [:__figwheel_counter] inc)
)
