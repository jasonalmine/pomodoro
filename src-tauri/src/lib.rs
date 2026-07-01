use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

/// Set (or clear) the text shown next to the tray icon in the macOS menu bar.
/// Called from the webview each time the formatted countdown changes.
#[tauri::command]
fn set_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let value = if title.is_empty() { None } else { Some(title) };
        let _ = tray.set_title(value);
    }
}

/// Show + focus the main window, or hide it if it's already visible.
fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Always bring the main window forward (used by the "Open" menu item).
fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_tray_title])
        .setup(|app| {
            // Run as a menu-bar (accessory) app: no Dock icon, lives in the status bar.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            let start_pause =
                MenuItem::with_id(app, "startPause", "Start / Pause", true, None::<&str>)?;
            let skip = MenuItem::with_id(app, "skip", "Skip", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open Pomodoro", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&start_pause, &skip, &sep, &open, &quit])?;

            let mut builder = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .icon_as_template(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "startPause" => {
                        let _ = app.emit("tray://action", "startPause");
                    }
                    "skip" => {
                        let _ = app.emit("tray://action", "skip");
                    }
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            // Dedicated monochrome hourglass template for the menu bar. macOS tints
            // the alpha shape to match light/dark, so this reads as a crisp glyph
            // rather than the app icon squashed into a silhouette.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            builder = builder.icon(tray_icon);

            builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it to the menu bar so the timer keeps running.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
