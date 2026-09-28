pub mod health;
pub mod sessions;
pub mod setup;
pub mod workspaces;
pub mod ws;

use axum::Router;

use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(health::router())
        .merge(workspaces::router())
        .merge(sessions::router())
        .merge(setup::router())
        .merge(ws::router())
}
