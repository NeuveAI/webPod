async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 320;
  canvas.setAttribute('layoutsubtree', 'true'); canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', left: '0', bottom: '0', width: '320px', height: '160px', pointerEvents: 'none', zIndex: '-1' });
  const child = document.createElement('div'); child.setAttribute('drawable', '');
  Object.assign(child.style, { width: '320px', height: '160px', background: 'repeating-linear-gradient(90deg, rgb(255,0,0) 0px 8px, rgb(0,0,255) 8px 16px)' });
  child.textContent='Music MENU Aa 0123'; child.style.font='20px Arial'; canvas.append(child); document.body.append(canvas);
  const workerSource = `let device, context, texture, buffer;
    const cleanup = () => { try { buffer?.destroy(); texture?.destroy(); context?.unconfigure(); device?.destroy(); } catch {} };
    self.onmessage = async ({ data }) => {
      try {
        if (data.canvas) {
          if (!navigator.gpu) throw Error('Worker navigator.gpu missing');
          const adapter = await navigator.gpu.requestAdapter();
          if (!adapter) throw Error('No worker WebGPU adapter');
          device = await adapter.requestDevice(); context = data.canvas.getContext('webgpu');
          if (!context) throw Error('Associated worker WebGPU context missing');
          context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'premultiplied' });
          self.postMessage({ stage: 'ready', adapterReady: true, copy: typeof device.queue.copyElementImageToTexture }); return;
        }
        if (data.image) {
          const image = data.image;
          const sourceWidth = image.width, sourceHeight = image.height; let result;
          try {
            device.pushErrorScope('validation');
            texture = device.createTexture({ size: [960, 480], format: 'rgba8unorm', usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
            device.queue.copyElementImageToTexture({ source: image }, { destination: { texture, colorSpace: 'srgb', premultipliedAlpha: false }, width: 960, height: 480 });
            // Validation-only one-row GPU readback, never a runtime transport design.
            buffer = device.createBuffer({ size: 3840, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer({ texture, origin: [0, 240, 0] }, { buffer, bytesPerRow: 3840 }, [960, 1, 1]);
            device.queue.submit([encoder.finish()]);
            await buffer.mapAsync(GPUMapMode.READ);
            const values = new Uint8Array(buffer.getMappedRange()); const sampleXs=[12,36,60,84,924,948]; const pixels=sampleXs.map(x=>Array.from(values.slice(x*4,x*4+4)));
            buffer.unmap(); const validation = await device.popErrorScope();
            result = { stage: 'result', ok: validation === null, sourceWidth, sourceHeight, textureWidth: 960, textureHeight: 480, sampleXs, pixels, expectedPixels: [[255,0,0,255],[0,0,255,255],[255,0,0,255],[0,0,255,255],[255,0,0,255],[0,0,255,255]], qualification: 'Stripe-center sampling checks scaled extent and color/alpha; text present but glyph quality not measured', validation: validation?.message ?? null };
          } finally { image.close(); cleanup(); }
          self.postMessage(result);
        }
      } catch (error) { data.image?.close(); cleanup(); self.postMessage({ stage: 'result', ok: false, error: String(error) }); }
    };`;
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  let worker, timeout, onPaint, image;
  try {
    worker = new Worker(url);
    return await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(Error('Associated WebGPU probe timed out')), 10000);
      worker.onerror = event => reject(Error(event.message)); worker.onmessageerror = () => reject(Error('Worker message decode failed'));
      worker.onmessage = event => {
        if (event.data.stage === 'ready') {
          onPaint = () => {
            canvas.removeEventListener('paint', onPaint);
            try { image = canvas.captureElementImage(child); worker.postMessage({ image }, [image]); image = undefined; }
            catch (error) { reject(error); }
          };
          canvas.addEventListener('paint', onPaint); canvas.requestPaint();
        } else resolve(event.data);
      };
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ canvas: offscreen }, [offscreen]);
    });
  } finally {
    clearTimeout(timeout); if (onPaint) canvas.removeEventListener('paint', onPaint);
    image?.close(); worker?.terminate(); URL.revokeObjectURL(url); canvas.remove();
  }
}
