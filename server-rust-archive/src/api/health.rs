use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use std::time::SystemTime;

use crate::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    conductor_db_exists: bool,
    conductor_db_last_modified: Option<String>,
    conductor_running: bool,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_path = state.config.db_path();
    let db_exists = db_path.exists();

    let db_last_modified = if db_exists {
        std::fs::metadata(db_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| {
                t.duration_since(SystemTime::UNIX_EPOCH)
                    .ok()
                    .map(|d| {
                        chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                            .map(|dt| dt.to_rfc3339())
                    })
            })
            .flatten()
    } else {
        None
    };

    let conductor_running = is_conductor_running();

    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        conductor_db_exists: db_exists,
        conductor_db_last_modified: db_last_modified,
        conductor_running,
    })
}

fn is_conductor_running() -> bool {
    let system = sysinfo::System::new_with_specifics(
        sysinfo::RefreshKind::nothing().with_processes(sysinfo::ProcessRefreshKind::nothing()),
    );
    system
        .processes()
        .values()
        .any(|p| p.name().to_string_lossy().contains("conductor") || p.name().to_string_lossy().contains("Conductor"))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/health", get(health))
}
