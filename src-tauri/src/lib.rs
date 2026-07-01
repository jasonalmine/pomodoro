use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WindowEvent,
};

// Whether the window is currently acting as the menu-bar popover panel (small,
// frameless, hides on blur) versus the full app window. Drives blur-to-hide.
struct PanelState {
    is_panel: Mutex<bool>,
}

const PANEL_W: f64 = 380.0;
const PANEL_H: f64 = 560.0;
const FULL_W: f64 = 1100.0;
const FULL_H: f64 = 820.0;

/// Set (or clear) the tray title text (the live countdown) in the menu bar.
#[tauri::command]
fn set_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let value = if title.is_empty() { None } else { Some(title) };
        let _ = tray.set_title(value);
    }
}

/// Expand the popover into the full app window (decorated, centered).
#[tauri::command]
fn open_full(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        *app.state::<PanelState>().is_panel.lock().unwrap() = false;
        let _ = win.set_always_on_top(false);
        let _ = win.set_decorations(true);
        let _ = win.set_resizable(true);
        let _ = win.set_size(LogicalSize::new(FULL_W, FULL_H));
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = app.emit("app-mode", "full");
    }
}

/// Show the compact popover anchored just below the clicked tray icon, or hide
/// it if it's already visible (menu-bar toggle behaviour).
fn toggle_panel(app: &AppHandle, cursor: PhysicalPosition<f64>) {
    let Some(win) = app.get_webview_window("main") else { return };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    *app.state::<PanelState>().is_panel.lock().unwrap() = true;
    let _ = win.set_decorations(false);
    let _ = win.set_always_on_top(true);
    let _ = win.set_resizable(false);
    let _ = win.set_size(LogicalSize::new(PANEL_W, PANEL_H));
    // Anchor centered under the cursor (which sits on the menu-bar icon).
    let scale = win.scale_factor().unwrap_or(1.0);
    let x = cursor.x - (PANEL_W * scale) / 2.0;
    let y = cursor.y + 6.0;
    let _ = win.set_position(PhysicalPosition::new(x.max(0.0), y));
    let _ = app.emit("app-mode", "panel");
    let _ = win.show();
    let _ = win.set_focus();
}

pub fn run() {
    tauri::Builder::default()
        .manage(PanelState {
            is_panel: Mutex::new(true),
        })
        .invoke_handler(tauri::generate_handler![set_tray_title, open_full])
        .setup(|app| {
            // Menu-bar (accessory) app: no Dock icon, lives in the status bar.
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
                    "open" => open_full(app.clone()),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        toggle_panel(tray.app_handle(), position);
                    }
                });

            // Dedicated monochrome hourglass template for the menu bar.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            builder = builder.icon(tray_icon);
            builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the window hides it to the menu bar so the timer keeps running.
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            // A real popover dismisses itself when it loses focus — but only in
            // panel mode; the full window stays put.
            WindowEvent::Focused(false) => {
                if window.label() == "main" {
                    let state = window.app_handle().state::<PanelState>();
                    let is_panel = *state.is_panel.lock().unwrap();
                    if is_panel {
                        let _ = window.hide();
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
