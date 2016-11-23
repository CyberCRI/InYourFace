(ns website.core
  (:require-macros [cljs.core.async.macros :refer [go go-loop]])
  (:require [rum.core :as rum]
            [bidi.bidi :as bidi]
            [accountant.core :as accountant]
            [cljs.core.async :refer [<! >! put! chan]]))

(enable-console-print!)

(println "This text is printed from src/website/core.cljs. Go ahead and edit it and see reloading in action. xx")

;; define your app data so that it doesn't get over-written on reload

; (defonce app-state (atom {:text "Hello world!"}))

(def connection-options {"baseUrl" "http://localhost:5050"})

(def search-filter {"entityType" "event" 
                    "gameVersion" "bc02efcb-a95c-433d-bbc9-c2aa83f795c4"
                    "eventType" "results"})

(defn list-results []
  (let [promise-chan (chan 1)] 
    (-> 
      (.executeQuery js/redmetrics (clj->js connection-options) (clj->js search-filter))
      (.then (fn [result] (put! promise-chan (-> (js->clj result)
                                                 (get "data"))))))
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


; Components

(rum/defc single-result < rum/static [result]
  [:p (str "# Males " (get-in result ["customData" "results" "gender" "Male"]))])


; Pages

(rum/defcs home-page < 
           rum/static 
           (rum/local nil :results)
           { :will-mount (fn [state]
                          (go (reset! (:results state) (<! (list-results))))
                          state) }
  [state]
  (let [results-atom (:results state)]
    [:h1 "Home page"]
    (if (nil? @results-atom)
      [:h2 "Loading..."]
      [:h2 (str "Got " (count @results-atom) " results")
       (map single-result @results-atom)]))) 
  
(rum/defcs single-result-page < 
           rum/static 
           (rum/local nil :result)
           { :will-mount (fn [state]
                           (let [result-id (-> state :rum/args first)]
                            (go (reset! (:result state) (<! (get-result result-id)))))
                          state) }
  [state result-id]
  (let [result-atom (:result state)]
    [:h1 (str "Single result page " result-id)]
    (if (nil? @result-atom)
      [:h2 "Loading..."]
      [:h2 "Results"
       (single-result @result-atom)])))

(rum/defc error-page []
    [:h1 "Error: no such page"])




; Routing
(def app-routes ["/" {"" :home-page
                      ["result/" :result-id] :single-result-page}])

(defn path-exists? [path]
  (boolean (bidi/match-route app-routes path)))

(defn nav-handler [path]  
  (let [{:keys [handler route-params]} (bidi/match-route app-routes path)
        ; Here we manually unpack the route parameters and make components. There must be a better way!
        component (condp = handler
                   :home-page (home-page)
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
