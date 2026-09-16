use std::sync::Mutex;
use std::io::Write;
use tauri::{
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

// Tray events land nowhere visible in a menu-bar app, so append them to
// ~/Library/Logs/Pomodoro/tray.log for diagnosis.
fn tray_log(line: &str) {
    let Ok(home) = std::env::var("HOME") else { return };
    let dir = std::path::Path::new(&home).join("Library/Logs/Pomodoro");
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("tray.log")) {
        let _ = writeln!(f, "{} {line}", chrono_free_now());
    }
}

fn chrono_free_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Quit from the popover (there is no tray menu any more).
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Set (or clear) the tray title text (the live countdown) in the menu bar.
#[tauri::command]
fn set_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let value = if title.is_empty() { None } else { Some(title) };
        let _ = tray.set_title(value);
    }
}

// The full window needs a Regular activation policy to come to the front and
// take keyboard focus; the popover goes back to Accessory (no Dock icon).
fn set_policy(app: &AppHandle, regular: bool) {
    #[cfg(target_os = "macos")]
    {
        let policy = if regular {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        };
        let _ = app.set_activation_policy(policy);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, regular);
}

/// Expand the popover into the full app window (decorated, centered). `route`
/// optionally deep-links a page (e.g. "/settings") once the full app renders.
#[tauri::command]
fn open_full(app: AppHandle, route: Option<String>) {
    if let Some(win) = app.get_webview_window("main") {
        *app.state::<PanelState>().is_panel.lock().unwrap() = false;
        set_policy(&app, true);
        let _ = win.set_always_on_top(false);
        let _ = win.set_decorations(true);
        let _ = win.set_resizable(true);
        let _ = win.set_size(LogicalSize::new(FULL_W, FULL_H));
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = app.emit("app-mode", "full");
        if let Some(r) = route {
            let _ = app.emit("app-route", r);
        }
    }
}

/// Show the compact popover anchored just below the clicked tray icon. Always
/// shows (never toggles): blur-to-hide already closes it, and a click-to-toggle
/// races that blur so clicks looked dead.
fn show_panel(app: &AppHandle, cursor: PhysicalPosition<f64>) {
    let Some(win) = app.get_webview_window("main") else { return };
    // Restyle only while hidden: changing decorations/size on a visible
    // NSWindow (e.g. the full window is open when the tray is clicked) can
    // leave it blank or off-screen. Dropping to Accessory here is safe for the
    // same reason: the deactivation-blur lands on an already hidden window.
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    }
    *app.state::<PanelState>().is_panel.lock().unwrap() = true;
    set_policy(app, false);
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
        .plugin(tauri_plugin_notification::init())
        .manage(PanelState {
            is_panel: Mutex::new(true),
        })
        .invoke_handler(tauri::generate_handler![set_tray_title, open_full, quit_app])
        .setup(|app| {
            // Menu-bar (accessory) app: no Dock icon, lives in the status bar.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // No native menu on the tray: with one attached, macOS 27 opens the
            // menu on a plain left click and the popover never shows. Every
            // action lives in the popover instead (quit included).
            let builder = TrayIconBuilder::with_id("main")
                .show_menu_on_left_click(false)
                .icon_as_template(true)
                .on_tray_icon_event(|tray, event| {
                    tray_log(&format!("{event:?}"));
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left | MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        show_panel(tray.app_handle(), position);
                    }
                });

            // Dedicated monochrome hourglass template for the menu bar.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            builder.icon(tray_icon).build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the window hides it to the menu bar so the timer keeps running.
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    set_policy(window.app_handle(), false);
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
