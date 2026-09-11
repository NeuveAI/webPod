"""Read an existing Chrome trace; no browser/tool recording or application writes."""
import collections
import gzip
import hashlib
import json
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else '/Users/vinicius/Downloads/Trace-20260912T000938.json.gz')
trace = json.loads(gzip.decompress(path.read_bytes()))
events = trace['traceEvents']
pid, main_tid = 62025, 4853675
profiles = {e['id']: e['args']['data']['startTime'] for e in events if e.get('pid') == pid and e.get('tid') == main_tid and e['name'] == 'Profile'}
clock = profiles.copy()
nodes, raw = {}, []
for event in events:
    if event.get('pid') != pid or event['name'] != 'ProfileChunk' or event.get('id') not in profiles:
        continue
    data = event['args']['data']
    profile = data.get('cpuProfile', {})
    for node in profile.get('nodes', []):
        nodes[node['id']] = node
    assert len(profile.get('samples', [])) == len(data.get('timeDeltas', []))
    for sample, delta in zip(profile.get('samples', []), data.get('timeDeltas', [])):
        clock[event['id']] += delta
        raw.append((clock[event['id']], delta, sample))

def chain(node_id):
    seen = set()
    while node_id in nodes and node_id not in seen:
        seen.add(node_id)
        yield node_id
        node_id = nodes[node_id].get('parent')

def key(node_id):
    frame = nodes[node_id]['callFrame']
    return (frame.get('functionName') or '(anonymous)', frame.get('url', '').split('?')[0], frame.get('lineNumber', -1) + 1)

# Time deltas can be negative in this export. Sort reconstructed timestamps,
# integrate each stack until the next sample, and never charge the unsampled
# initial gap to the first stack. This is a sampled estimate, not exact CPU time.
ordered = sorted(raw, key=lambda row: row[0])
self_time, inclusive = collections.Counter(), collections.Counter()
intervals = []
for index, (start, _, sample) in enumerate(ordered[:-1]):
    end = ordered[index + 1][0]
    duration = end - start
    keys = {key(node) for node in chain(sample)}
    self_time[key(sample)] += duration
    for item in keys:
        inclusive[item] += duration
    intervals.append((start, end, keys))

begins, measures = {}, []
for event in events:
    if event.get('pid') != pid or event.get('tid') != main_tid or event['name'] != '\u200bStickerAppearanceEditor':
        continue
    identity = json.dumps(event.get('id2', event.get('id')), sort_keys=True)
    if event['ph'] == 'b':
        begins[identity] = event
    elif event['ph'] == 'e' and identity in begins:
        begin = begins.pop(identity)
        lo, hi = begin['ts'], event['ts']
        editor_us = sum(max(0, min(end, hi) - max(start, lo)) for start, end, keys in intervals if start < hi and end > lo and any(k[0] == 'StickerAppearanceEditor' for k in keys))
        detail = json.loads(begin.get('args', {}).get('detail', '{}'))
        measures.append({'startUs': lo, 'durationMs': (hi - lo) / 1000, 'sampledEditorInclusiveMs': editor_us / 1000, 'changedProps': detail.get('devtools', {}).get('properties', [])})
marks = [e['args']['data'] for e in events if e.get('pid') == pid and e.get('tid') == main_tid and e['name'] == 'TimeStamp' and e.get('args', {}).get('data', {}).get('name') == 'StickerAppearanceEditor']

def ranking(counter, maximum=25):
    return [{'function': name, 'url': url, 'transformedLine': line, 'ms': value / 1000} for (name, url, line), value in counter.most_common(maximum)]

interesting = ('StickerAppearanceEditor', 'contour', 'projectPreparedContour', 'visible', 'castSegment', 'chooseHudLayout', 'prepareStickerContourSteps', 'createStickerCollision')
result = {
    'traceFile': str(path), 'gzipSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'metadata': trace['metadata'], 'mainPid': pid, 'mainTid': main_tid, 'profileIds': profiles,
    'profileChunkTids': sorted({e['tid'] for e in events if e.get('pid') == pid and e['name'] == 'ProfileChunk' and e.get('id') in profiles}),
    'sampleCount': len(raw), 'nodeCount': len(nodes), 'negativeDeltaCount': sum(delta < 0 for _, delta, _ in raw),
    'negativeDeltaSumUs': sum(delta for _, delta, _ in raw if delta < 0),
    'initialUnsampledGapUs': ordered[0][0] - min(profiles.values()),
    'sampledIntervalMs': (ordered[-1][0] - ordered[0][0]) / 1000,
    'topSelf': ranking(self_time), 'topInclusive': ranking(inclusive, 35),
    'queryInclusive': ranking(collections.Counter({k: v for k, v in inclusive.items() if k[0] in interesting})),
    'editorSelfMs': sum(v for k, v in self_time.items() if k[0] == 'StickerAppearanceEditor') / 1000,
    'editorMeasures': {'count': len(measures), 'sumMs': sum(m['durationMs'] for m in measures), 'largest': sorted(measures, key=lambda m: m['durationMs'], reverse=True)[:8]},
    'editorTimeStamps': {'count': len(marks), 'maxMs': max((m['end'] - m['start']) / 1000 for m in marks)},
    'limits': 'Sampled inclusive estimates overlap ancestors; never sum them. Export does not capture editor shown/presence atom values. DEV profiler/CPU6x costs do not establish production timing.'
}
out = Path(__file__).with_name('editor-profile-analysis.json')
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(out), 'editorMeasures': result['editorMeasures'], 'editorSelfMs': result['editorSelfMs']}))
