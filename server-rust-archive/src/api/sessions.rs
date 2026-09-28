use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;

use crate::db::queries;
use crate::AppState;

async fn list_sessions(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sessions = queries::list_sessions(&state.db, &workspace_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list sessions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "sessions": sessions })))
}

async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session = queries::get_session(&state.db, &id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match session {
        Some(s) => Ok(Json(serde_json::json!({ "session": s }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct MessageParams {
    limit: Option<i64>,
    before: Option<String>,
}

async fn list_messages(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Query(params): Query<MessageParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(200);
    let messages = queries::list_messages(
        &state.db,
        &session_id,
        limit,
        params.before.as_deref(),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to list messages: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<_> = messages.iter().map(|m| m.to_response()).collect();

    Ok(Json(serde_json::json!({
        "messages": responses,
        "has_more": messages.len() as i64 == limit,
    })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/workspaces/{workspace_id}/sessions", get(list_sessions))
        .route("/api/sessions/{id}", get(get_session))
        .route("/api/sessions/{id}/messages", get(list_messages))
}
