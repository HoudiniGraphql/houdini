export type { InitData }
export { initDataHtmlClass }

type InitData = { value: unknown; key: string; elementId: string }
const initDataHtmlClass = 'react-streaming_initData'
