import App from '$houdini/plugins/houdini-react/units/render/App'
import React from 'react'
import { createRoot } from 'react-dom/client'

const domNode = document.getElementById('app')
const root = createRoot(domNode)

root.render(React.createElement(App))
