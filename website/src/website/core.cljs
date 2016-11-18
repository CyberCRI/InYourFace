(ns website.core
  (:require [rum.core :as rum]
            [bidi.bidi :as bidi]
            [accountant.core :as accountant]))

(enable-console-print!)

(println "This text is printed from src/website/core.cljs. Go ahead and edit it and see reloading in action. xx")

;; define your app data so that it doesn't get over-written on reload

; (defonce app-state (atom {:text "Hello world!"}))

(rum/defc home-page []
    [:h1 "Home page"])
  
(rum/defc single-result-page [result-id]
    [:h1 (str "Single result page " result-id)])


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
                   :single-result-page (single-result-page (:result-id route-params)))]
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
