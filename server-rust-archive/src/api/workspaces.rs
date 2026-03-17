use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};

use crate::db::queries;
use crate::AppState;

async fn list_workspaces(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let workspaces = queries::list_workspaces(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list workspaces: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "workspaces": workspaces })))
}

async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let workspace = queries::get_workspace(&state.db, &id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get workspace: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match workspace {
        Some(ws) => Ok(Json(serde_json::json!({ "workspace": ws }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/workspaces", get(list_workspaces))
        .route("/api/workspaces/{id}", get(get_workspace))
}
