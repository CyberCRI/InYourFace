port module Main exposing (..)

import Html exposing (..)
import Html.App as App
import Html.Attributes exposing (attribute, style, class, id, href)
import Http 
import Json.Decode exposing (..)
import Json.Decode.Pipeline exposing (decode, required)
import Task
import Array
import String


main =
  App.programWithFlags { init = init, view = view, subscriptions = subscriptions, update = update }


-- Functions

getSessionStats : String -> Cmd Msg
getSessionStats playerId =
  let
    url =
      "https://api.redmetrics.io/v1/event?game=67475d78-09af-4f23-95fa-45a700f08057&type=statistics&player=" ++ playerId
  in
    Task.perform FetchFail FetchSucceed (Http.get decodeStatistics url)

decodeStatistics : Decoder (List Statistics)
decodeStatistics =
  list ("customData" := (decode Statistics 
    |> required "foundShapeCount" int 
    |> required "newShapeCount" int
    |> required "categoryCount" int
    |> required "meanCreated" int
    |> required "beautifulPercent" int
    |> required "foundPopularShape" bool
    |> required "searchScore" float
    |> required "searchScorePercent" int
    |> required "searchStyle" string
    |> required "searchResults" string
   )) 

-- Expecting a URL like "/results/UID" which splits into ["", "results", "UID"]
getPlayerId : String -> Maybe String
getPlayerId path = 
  let 
    a = Array.fromList (String.split "/" path)
    l = Array.length a
  in 
    if l /= 3 then
      Nothing
    else 
      Array.get 2 a


-- MODEL

type alias Statistics =
  {
    foundShapeCount : Int
  , newShapeCount: Int
  , categoryCount: Int
  , meanCreated: Int
  , beautifulPercent: Int
  , foundPopularShape: Bool
  , searchScore: Float
  , searchScorePercent: Int
  , searchStyle: String
  , searchResults: String
  }

type StatisticsOwnership = Yes Statistics | No | Looking 

type alias Model = 
  { playerId: Maybe String
  , statistics: StatisticsOwnership 
  }


init : { path: Maybe String } -> (Model, Cmd Msg)
init flags = 
  case flags.path of
    Just path -> 
      let 
        playerId = getPlayerId path
      in 
        case playerId of
          Just playerId -> ({ playerId = Just playerId, statistics = Looking }, getSessionStats playerId)
          Nothing -> ({ playerId = Nothing, statistics = No }, Cmd.none)
    Nothing -> ({ playerId = Nothing, statistics = No }, Cmd.none)

-- Temporarily fake data without internet connection
--init flags = 
--  ({  playerId = Just "qsdf" 
--    , statistics =
--        Just {
--          foundShapeCount = 10
--        , newShapeCount = 2
--        , categoryCount = 1
--        , meanCreated = 4
--        , beautifulPercent = 33
--        , foundPopularShape = True
--        , searchScore = 0
--        , searchScorePercent = 100
--        , searchStyle = "fast and exhaustive"
--        , searchResults = "unique"
--        } 
--    }, 
--    Cmd.none)


-- UPDATE

type Msg = FetchSucceed (List Statistics)
  | FetchFail Http.Error 

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    FetchSucceed value -> 
      case (List.head value) of 
        Nothing -> (model, Cmd.none)
        Just statistics -> ({ model | statistics = Yes statistics }, Cmd.none)
    FetchFail _ -> ({ model | statistics = No }, Cmd.none)


-- SUBSCRIPTIONS

subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.none


-- VIEW

view : Model -> Html Msg
view model =
  div []
  [
    h3 [] [text "In Your Face"]
  , case model.statistics of 
      No -> p [] [text ("Can't find any statistics for you")]
      Looking -> p [] [text ("Looking up your statistics ...")]
      Yes statistics -> 
        div [] 
        [
          p [] 
          [
            (text "You created ")
          , (span [class "highlight"] [text (toString statistics.foundShapeCount)])
          , (text " shapes.")
          ]
        , p [] 
          [
            (text "Your most unique collected shapes were found by ") 
          , (span [class "highlight"] [text (toString statistics.meanCreated ++ "%")])
          , (text " of other people.") 
          ]
        , p []
          [
            (span [class "highlight"] [text (toString statistics.beautifulPercent ++ "%")])
          , (text " of the beautiful shapes you chose were thought as beautiful by other people.")
          ]
        , if statistics.foundPopularShape then
            p [] 
            [
              (text "Your most beautiful shape got ")
            , (span [class "highlight"] [text "extremely high ratings"])
            , (text " by other players.")
            ]
          else
            text ""
        , div [id "slider-container"] 
          [
            div [id "slider"] []
          , let 
              -- searchScore is in the range [-1, 1]
              ballOffset = (toString ((statistics.searchScore + 1) / 2 * 510)) ++ "px"
            in 
              div [id "slider-ball", style [("left", ballOffset)]] []
          ]
        , p []
          [
            (text "Your playing method suggests you are ")
          , (span [class "highlight"] [text (toString statistics.searchScorePercent ++ "%")])
          , (text " to make ")
          , (span [class "highlight"] [text statistics.searchStyle])
          , (text " searches")
          ]
        , p []
          [
            (text "These kind of creative searches tend to provide more ")
          , (span [class "highlight"] [text statistics.searchResults])
          , (text " shapes in our game.")
          ]
        , div [id "share-block"]
          [
            p [] [text "Share your score and invite others to play and discover their creative search strategies."]
          ]
        ]
  ]
