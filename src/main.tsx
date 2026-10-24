import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'katex/dist/katex.min.css'
import './styles/global.css'

// 暴露给外部插件的面板渲染通道（无构建步骤的裸 JS 通过它使用 React）
;(window as any).XNoteReact = React

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
