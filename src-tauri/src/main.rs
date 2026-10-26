// X-Note 桌面端入口：挂载前端 + 注册 fs / dialog / shell / updater / process / http 插件
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // AI 等第三方接口都需要在 Rust 侧发请求：WebView 里 fetch 会被 CORS 拦掉
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running X-Note");
}
