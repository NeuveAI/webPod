import type { Page } from '@playwright/test'

/** Test-only WebGL2 submitted-draw recorder. No renderer or product state seam. */
export async function installStickerMatrixRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Matrix = readonly number[]
    type Attribute = { buffer: WebGLBuffer | null; size: number; type: number; normalized: boolean; stride: number; offset: number }
    type Program = { id: number; matrices: Record<string, Matrix>; samplers: Record<string, number>; attributes: Record<string, number> }
    type BufferRecord = { id: number; bytes: Uint8Array; revision: number; fingerprint?: string }
    type Vao = { attributes: Map<number, Attribute>; index: WebGLBuffer | null }
    const MAX_BYTES = 64 * 1024 * 1024
    const buffers = new Map<WebGLBuffer, BufferRecord>()
    const programs = new Map<WebGLProgram, Program>()
    const uniforms = new WeakMap<WebGLUniformLocation, { program: Program; name: string }>()
    const textures = new WeakMap<WebGLTexture, string>()
    const states = new WeakMap<WebGL2RenderingContext, { program: Program | null; array: WebGLBuffer | null; vao: Vao; vaos: Map<WebGLVertexArrayObject | null, Vao>; textureUnit: number; units: Map<number, WebGLTexture | null>; framebuffer: WebGLFramebuffer | null; viewport: number[]; pass: number }>()
    const recent: unknown[] = []
    let bytesRetained = 0, nextBuffer = 0, nextProgram = 0, drawId = 0, failure: string | null = null
    let candidates: { draw: Record<string, unknown>; buffers: { role: string; id: number; revision: number; bytes: Uint8Array }[] }[] = []
    const program = (p: WebGLProgram) => {
      let item = programs.get(p)
      if (item === undefined) { item = { id: ++nextProgram, matrices: {}, samplers: {}, attributes: {} }; programs.set(p, item) }
      return item
    }
    const state = (gl: WebGL2RenderingContext) => {
      let item = states.get(gl)
      if (item === undefined) { const vao = { attributes: new Map(), index: null }; item = { program: null, array: null, vao, vaos: new Map([[null, vao]]), textureUnit: gl.TEXTURE0, units: new Map(), framebuffer: null, viewport: [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight], pass: 0 }; states.set(gl, item) }
      return item
    }
    const dataBytes = (data: unknown): Uint8Array | null => ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data instanceof ArrayBuffer ? new Uint8Array(data) : null
    // Fast identity for surrounding shell draws; C03 raw buffers receive SHA256 below.
    const fingerprint = (bytes: Uint8Array) => { let hash = 2166136261; for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619); return (hash >>> 0).toString(16).padStart(8, '0') }
    const wrap = (name: string, observe: (gl: WebGL2RenderingContext, args: unknown[], result: unknown) => void) => {
      const descriptor = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, name)
      if (descriptor === undefined || typeof descriptor.value !== 'function') throw new Error(`Missing WebGL2 method ${name}`)
      const original = descriptor.value as (...args: unknown[]) => unknown
      Object.defineProperty(WebGL2RenderingContext.prototype, name, { ...descriptor, value: function(this: WebGL2RenderingContext, ...args: unknown[]) {
        const result = original.apply(this, args)
        try { observe(this, args, result) } catch (error) { failure = String(error) }
        return result
      } })
    }
    wrap('useProgram', (gl, [p]) => { state(gl).program = p === null ? null : program(p as WebGLProgram) })
    wrap('deleteProgram', (_gl, [p]) => { programs.delete(p as WebGLProgram) })
    wrap('getUniformLocation', (_gl, [p, name], result) => { if (result !== null) uniforms.set(result as WebGLUniformLocation, { program: program(p as WebGLProgram), name: String(name) }) })
    wrap('getAttribLocation', (_gl, [p, name], result) => { program(p as WebGLProgram).attributes[String(name)] = Number(result) })
    wrap('uniformMatrix4fv', (_gl, [location, transpose, data, start]) => {
      const u = uniforms.get(location as WebGLUniformLocation)
      if (u !== undefined && ['modelMatrix', 'viewMatrix', 'modelViewMatrix', 'projectionMatrix'].includes(u.name)) {
        if (transpose !== false) throw new Error('Unexpected transposed draw matrix')
        u.program.matrices[u.name] = Array.from(data as ArrayLike<number>).slice(Number(start ?? 0), Number(start ?? 0) + 16)
      }
    })
    wrap('uniform1i', (_gl, [location, value]) => { const u = uniforms.get(location as WebGLUniformLocation); if (u !== undefined) u.program.samplers[u.name] = Number(value) })
    wrap('activeTexture', (gl, [unit]) => { state(gl).textureUnit = Number(unit) })
    wrap('bindTexture', (gl, [target, texture]) => { if (target === gl.TEXTURE_2D) state(gl).units.set(state(gl).textureUnit - gl.TEXTURE0, texture as WebGLTexture | null) })
    const textureUpload = (gl: WebGL2RenderingContext, args: unknown[]) => {
      const source = args.find(arg => arg instanceof HTMLImageElement)
      const texture = state(gl).units.get(state(gl).textureUnit - gl.TEXTURE0)
      if (source instanceof HTMLImageElement && texture != null) textures.set(texture, source.currentSrc || source.src)
    }
    wrap('texImage2D', textureUpload)
    wrap('texSubImage2D', textureUpload)
    wrap('bindVertexArray', (gl, [key]) => {
      const s = state(gl), object = key as WebGLVertexArrayObject | null
      let vao = s.vaos.get(object)
      if (vao === undefined) { vao = { attributes: new Map(), index: null }; s.vaos.set(object, vao) }
      s.vao = vao
    })
    wrap('deleteVertexArray', (gl, [key]) => {
      const s = state(gl), object = key as WebGLVertexArrayObject
      const deleted = s.vaos.get(object)
      s.vaos.delete(object)
      if (s.vao === deleted) { const fallback = s.vaos.get(null); if (fallback !== undefined) s.vao = fallback }
    })
    wrap('bindBuffer', (gl, [target, buffer]) => { const s = state(gl); if (target === gl.ARRAY_BUFFER) s.array = buffer as WebGLBuffer | null; else if (target === gl.ELEMENT_ARRAY_BUFFER) s.vao.index = buffer as WebGLBuffer | null })
    wrap('bufferData', (gl, [target, data, , start, length]) => {
      const s = state(gl), key = target === gl.ARRAY_BUFFER ? s.array : target === gl.ELEMENT_ARRAY_BUFFER ? s.vao.index : null
      if (key === null) return
      const source = dataBytes(data)
      const elementBytes = ArrayBuffer.isView(data) && 'BYTES_PER_ELEMENT' in data ? Number(data.BYTES_PER_ELEMENT) : 1
      const begin = Number(start ?? 0) * elementBytes
      const size = source === null ? Number(data) : length === undefined ? source.byteLength - begin : Number(length) * elementBytes
      const previous = buffers.get(key)
      if (bytesRetained - (previous?.bytes.byteLength ?? 0) + size > MAX_BYTES) throw new Error('Matrix recorder exceeded 64MiB buffer cap')
      const bytes = source === null ? new Uint8Array(size) : source.slice(begin, begin + size)
      bytesRetained += bytes.byteLength - (previous?.bytes.byteLength ?? 0)
      buffers.set(key, { id: previous?.id ?? ++nextBuffer, bytes, revision: (previous?.revision ?? 0) + 1 })
    })
    wrap('bufferSubData', (gl, [target, offset, data, start, length]) => {
      const s = state(gl), key = target === gl.ARRAY_BUFFER ? s.array : s.vao.index
      const record = key === null ? undefined : buffers.get(key), source = dataBytes(data)
      if (record === undefined || source === null) throw new Error('Missing base buffer upload')
      const elementBytes = ArrayBuffer.isView(data) && 'BYTES_PER_ELEMENT' in data ? Number(data.BYTES_PER_ELEMENT) : 1
      const begin = Number(start ?? 0) * elementBytes, end = length === undefined ? source.byteLength : begin + Number(length) * elementBytes
      record.bytes.set(source.subarray(begin, end), Number(offset)); record.revision++; delete record.fingerprint
    })
    wrap('deleteBuffer', (_gl, [key]) => { const record = buffers.get(key as WebGLBuffer); if (record !== undefined) bytesRetained -= record.bytes.byteLength; buffers.delete(key as WebGLBuffer) })
    wrap('vertexAttribPointer', (gl, [index, size, type, normalized, stride, offset]) => { const s = state(gl); s.vao.attributes.set(Number(index), { buffer: s.array, size: Number(size), type: Number(type), normalized: Boolean(normalized), stride: Number(stride), offset: Number(offset) }) })
    wrap('bindFramebuffer', (gl, [target, fb]) => { if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) state(gl).framebuffer = fb as WebGLFramebuffer | null })
    wrap('viewport', (gl, args) => { state(gl).viewport = args.map(Number) })
    wrap('clear', (gl, [mask]) => { if ((Number(mask) & gl.COLOR_BUFFER_BIT) !== 0 && state(gl).framebuffer === null) state(gl).pass++ })
    const recordDraw = (kind: 'drawElements' | 'drawArrays', gl: WebGL2RenderingContext, args: unknown[]) => {
      const s = state(gl), p = s.program
      if (p === null || s.framebuffer !== null) return
      const bindings: Record<string, unknown> = {}, raw: { role: string; id: number; revision: number; bytes: Uint8Array }[] = []
      for (const role of ['position', 'uv', 'index']) {
        if (role === 'index' && kind === 'drawArrays') continue
        const layout = role === 'index' ? null : s.vao.attributes.get(p.attributes[role] ?? -1)
        const key = role === 'index' ? s.vao.index : layout?.buffer
        const record = key == null ? undefined : buffers.get(key)
        if (record !== undefined) {
          bindings[role] = { id: record.id, revision: record.revision, byteLength: record.bytes.byteLength, fnv1a: record.fingerprint ??= fingerprint(record.bytes), layout: layout === null || layout === undefined ? null : { ...layout, buffer: undefined } }
          raw.push({ role, id: record.id, revision: record.revision, bytes: record.bytes })
        }
      }
      const texture = s.units.get(p.samplers.map ?? -1), mapUrl = texture == null ? null : textures.get(texture) ?? null
      const canvas = gl.canvas
      const rect = canvas instanceof HTMLCanvasElement ? canvas.getBoundingClientRect().toJSON() : null
      const primitive = kind === 'drawArrays' ? { indexed: false, mode: Number(args[0]), first: Number(args[1]), count: Number(args[2]) } : { indexed: true, mode: Number(args[0]), count: Number(args[1]), indexType: Number(args[2]), byteOffset: Number(args[3]) }
      const raster = { cullEnabled: gl.isEnabled(gl.CULL_FACE), cullFace: gl.getParameter(gl.CULL_FACE_MODE), frontFace: gl.getParameter(gl.FRONT_FACE) }
      const draw = { id: ++drawId, pass: s.pass, program: p.id, timeMs: performance.now(), kind, args, primitive, raster, matrices: structuredClone(p.matrices), bindings, mapUrl, canvasRect: rect, canvasSize: [canvas.width, canvas.height], viewport: [...s.viewport], windowSize: [innerWidth, innerHeight] }
      recent.push(draw); if (recent.length > 256) recent.shift()
      if (mapUrl?.includes('/pw-c03-last-encore.png')) {
        if (candidates[0]?.draw.pass !== s.pass) candidates = []
        if (candidates.length >= 8) throw new Error('Too many C03 draw candidates in one pass')
        candidates.push({ draw, buffers: raw.map(b => ({ ...b, bytes: b.bytes.slice() })) })
      }
    }
    wrap('drawElements', (gl, args) => recordDraw('drawElements', gl, args))
    wrap('drawArrays', (gl, args) => recordDraw('drawArrays', gl, args))
    Object.defineProperty(window, '__stickerMatrixCapture', { configurable: true, value: async () => {
      if (failure !== null) throw new Error(failure)
      if (candidates.length === 0) throw new Error('No actual C03 mapped draws captured')
      // Freeze all evidence before SHA awaits: a later browser frame must not alter correlation.
      const selectedCandidates = [...candidates], recentAtCapture = [...recent], retainedAtCapture = bytesRetained
      const latestPass = (recentAtCapture.at(-1) as { pass?: number } | undefined)?.pass
      if (selectedCandidates[0]?.draw.pass !== latestPass) throw new Error('C03 draws are stale relative to the latest default-framebuffer pass')
      const snapshotBytes = selectedCandidates.reduce((sum, candidate) => sum + candidate.buffers.reduce((bytes, buffer) => bytes + buffer.bytes.byteLength, 0), 0)
      const draws = await Promise.all(selectedCandidates.map(async candidate => {
        const matrices = candidate.draw.matrices as Record<string, Matrix>
        for (const name of ['modelMatrix', 'viewMatrix', 'modelViewMatrix', 'projectionMatrix']) if (matrices[name]?.length !== 16 || !matrices[name]?.every(Number.isFinite)) throw new Error('Missing actual draw matrix ' + name)
        for (const role of candidate.draw.kind === 'drawArrays' ? ['position', 'uv'] : ['position', 'uv', 'index']) if (!candidate.buffers.some(buffer => buffer.role === role)) throw new Error('Missing C03 ' + role + ' buffer')
        const snapshots = await Promise.all(candidate.buffers.map(async b => ({ ...b, bytes: Array.from(b.bytes), sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b.bytes).buffer))).map(v => v.toString(16).padStart(2, '0')).join('') })))
        return { draw: candidate.draw, rawBuffers: snapshots }
      }))
      return { version: 1, candidates: draws, recentDraws: recentAtCapture, bytesRetained: retainedAtCapture, bufferCapBytes: MAX_BYTES, snapshotBytes, memoryScope: '64MiB cap applies to upload buffers only; up to8 candidate byte snapshots and JSON serialization are additional', correlation: 'Offline solver must select equipped geometry by exact source/UV/index bytes and model matrix; same artwork may also appear on the packet', scope: 'test-only actual WebGL2 default-framebuffer draw capture; not performance measurement' }
    } })
  })
}

export async function readStickerMatrixCapture(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const capture = (window as typeof window & { __stickerMatrixCapture?: () => Promise<unknown> }).__stickerMatrixCapture
    if (capture === undefined) throw new Error('Matrix recorder was not installed before page load')
    return capture()
  })
}
