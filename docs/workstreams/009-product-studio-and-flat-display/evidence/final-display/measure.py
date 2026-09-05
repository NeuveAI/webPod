from pathlib import Path
from PIL import Image
import numpy as np
import json
p=Path(__file__).parent
out=[]
for path in [p/'black-front-lcd-matched.png',p/'white-front-lcd-matched.png']:
 a=np.array(Image.open(path).convert('RGB')).astype(int);samples=[]
 for f in [.04,.1,.25,.5,.75,.9,.96]:
  x=round(a.shape[1]*f);values=a[:,x].min(axis=1);d=values[18:36]-values[17:35]
  row=int(d.argmax())+18
  samples.append({'xFraction':f,'x':x,'lcdBoundaryY':row,'positiveChannelJump':int(d.max())})
 ys=[s['lcdBoundaryY']for s in samples]
 out.append({'file':str(path),'width':a.shape[1],'height':a.shape[0],'samples':samples,'verticalSpreadPhysicalPixels':max(ys)-min(ys)})
(p/'front-top-boundary.json').write_text(json.dumps({'method':'Largest positive jump in minimum RGB channel in rows18..35; matched 8CSSpx margin/DPR3 LCD crops. Restricted region brackets aperture border/LCD transition and avoids bright body and header content. This screenshot proxy complements production ray tests, not a replacement.','results':out},indent=2)+'\n')
print([(x['file'],x['verticalSpreadPhysicalPixels'],[s['lcdBoundaryY']for s in x['samples']])for x in out])
