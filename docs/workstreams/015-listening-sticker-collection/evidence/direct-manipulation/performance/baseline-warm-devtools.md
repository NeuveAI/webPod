The performance trace has been stopped.
Emulating viewport: {"deviceScaleFactor":1,"isMobile":false,"hasTouch":false,"isLandscape":false,"width":1280,"height":900}
## Summary of Performance trace findings:
URL: http://127.0.0.1:55696/
Trace bounds: {min: 514762868528µs, max: 514766331521µs}
CPU throttling: 1x
Network throttling: none

# Available insight sets

The following is a list of insight sets. An insight set covers a specific part of the trace, split by navigations. The insights within each insight set are specific to that part of the trace. Be sure to consider the insight set id and bounds when calling functions. If no specific insight set or navigation is mentioned, assume the user is referring to the first one.

## insight set id: NO_NAVIGATION

URL: http://127.0.0.1:55696/
Bounds: {min: 514762868528µs, max: 514766331521µs}
Metrics (lab / observed):
  - INP: 68 ms, event: (eventKey: s-45278, ts: 514762964238)
  - CLS: 0.00, event: (eventKey: s-8290, ts: 514763573880)
Metrics (field / real users): n/a – no data for this page in CrUX
Available insights:
  - insight name: INPBreakdown
    description: Start investigating [how to improve INP](https://developer.chrome.com/docs/performance/insights/inp-breakdown) by looking at the longest subpart.
    relevant trace bounds: {min: 514762964238µs, max: 514763031960µs}
    example question: Suggest fixes for my longest interaction
    example question: Why is a large INP score problematic?
    example question: What's the biggest contributor to my longest interaction?
  - insight name: CLSCulprits
    description: Layout shifts occur when elements move absent any user interaction. [Investigate the causes of layout shifts](https://developer.chrome.com/docs/performance/insights/cls-culprit), such as elements being added, removed, or their fonts changing as the page loads.
    relevant trace bounds: {min: 514763573880µs, max: 514764573880µs}
    example question: Help me optimize my CLS score
    example question: How can I prevent layout shifts on this page?

## Details on call tree & network request formats:
Information on performance traces may contain main thread activity represented as call frames and network requests.

Each call frame is presented in the following format:

'id;eventKey;name;duration;selfTime;urlIndex;childRange;[line];[column];[S]'

Key definitions:

* id: A unique numerical identifier for the call frame. Never mention this id in the output to the user.
* eventKey: String that uniquely identifies this event in the flame chart.
* name: A concise string describing the call frame (e.g., 'Evaluate Script', 'render', 'fetchData').
* duration: The total execution time of the call frame, including its children.
* selfTime: The time spent directly within the call frame, excluding its children's execution.
* urlIndex: Index referencing the "All URLs" list. Empty if no specific script URL is associated.
* childRange: Specifies the direct children of this node using their IDs. If empty ('' or 'S' at the end), the node has no children. If a single number (e.g., '4'), the node has one child with that ID. If in the format 'firstId-lastId' (e.g., '4-5'), it indicates a consecutive range of child IDs from 'firstId' to 'lastId', inclusive.
* line: An optional field for a call frame's line number. This is where the function is defined.
* column: An optional field for a call frame's column number. This is where the function is defined.
* S: _Optional_. The letter 'S' terminates the line if that call frame was selected by the user.

Example Call Tree:

1;r-123;main;500;100;0;1;;
2;r-124;update;200;50;;3;0;1;
3;p-49575-15428179-2834-374;animate;150;20;0;4-5;0;1;S
4;p-49575-15428179-3505-1162;calculatePosition;80;80;0;1;;
5;p-49575-15428179-5391-2767;applyStyles;50;50;0;1;;


Network requests are formatted like this:
`urlIndex;eventKey;queuedTime;requestSentTime;downloadCompleteTime;processingCompleteTime;totalDuration;downloadDuration;mainThreadProcessingDuration;statusCode;mimeType;priority;initialPriority;finalPriority;renderBlocking;protocol;fromServiceWorker;initiators;redirects:[[redirectUrlIndex|startTime|duration]];responseHeaders:[header1Value|header2Value|...]`

- `urlIndex`: Numerical index for the request's URL, referencing the "All URLs" list.
- `eventKey`: String that uniquely identifies this request's trace event.
Timings (all in milliseconds, relative to navigation start):
- `queuedTime`: When the request was queued.
- `requestSentTime`: When the request was sent.
- `downloadCompleteTime`: When the download completed.
- `processingCompleteTime`: When main thread processing finished.
Durations (all in milliseconds):
- `totalDuration`: Total time from the request being queued until its main thread processing completed.
- `downloadDuration`: Time spent actively downloading the resource.
- `mainThreadProcessingDuration`: Time spent on the main thread after the download completed.
- `statusCode`: The HTTP status code of the response (e.g., 200, 404).
- `mimeType`: The MIME type of the resource (e.g., "text/html", "application/javascript").
- `priority`: The final network request priority (e.g., "VeryHigh", "Low").
- `initialPriority`: The initial network request priority.
- `finalPriority`: The final network request priority (redundant if `priority` is always final, but kept for clarity if `initialPriority` and `priority` differ).
- `renderBlocking`: 't' if the request was render-blocking, 'f' otherwise.
- `protocol`: The network protocol used (e.g., "h2", "http/1.1").
- `fromServiceWorker`: 't' if the request was served from a service worker, 'f' otherwise.
- `initiators`: A list (separated by ,) of URL indices for the initiator chain of this request. Listed in order starting from the root request to the request that directly loaded this one. This represents the network dependencies necessary to load this request. If there is no initiator, this is empty.
- `redirects`: A comma-separated list of redirects, enclosed in square brackets. Each redirect is formatted as
`[redirectUrlIndex|startTime|duration]`, where: `redirectUrlIndex`: Numerical index for the redirect's URL. `startTime`: The start time of the redirect in milliseconds, relative to navigation start. `duration`: The duration of the redirect in milliseconds.
- `responseHeaders`: A list (separated by '|') of values for specific, pre-defined response headers, enclosed in square brackets.
The order of headers corresponds to an internal fixed list. If a header is not present, its value will be empty.

## Saved-detail limit

This actual stop-trace response contains overall INP68ms. A warm-run INPBreakdown follow-up was not retained, so no exact warm subpart decomposition is claimed. Per-event processingStart/processingEnd and quantized durations remain in baseline-warm-desktop-observers.json. The later native-drag breakdown is separately attributed to that run, not reused as warm-click evidence.
