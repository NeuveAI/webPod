import { createDevicePreviewStore, type DevicePreviewStore } from './device-preview-orientation'

// A component module can be reevaluated while its mounted gesture/tool callbacks
// survive. Keep their owner outside that module, including across dependency HMR.
const hotData = import.meta.hot?.data as { previewStore?: DevicePreviewStore } | undefined
export const previewStore = hotData?.previewStore ?? createDevicePreviewStore()
if (hotData !== undefined) hotData.previewStore = previewStore
