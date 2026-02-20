#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The library crate is declared in Cargo.toml as `app_lib`.
    // Keep `main.rs` minimal: it only delegates to the library entrypoint.
    app_lib::run();
}
