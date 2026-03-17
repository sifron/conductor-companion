use axum::{
    extract::{Query, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;

use crate::AppState;

#[derive(Deserialize)]
struct WsParams {
    token: Option<String>,
}

async fn ws_handler(
    State(state): State<AppState>,
    Query(params): Query<WsParams>,
    ws: WebSocketUpgrade,
) -> Response {
    // Authenticate via query param
    let authenticated = params
        .token
        .as_ref()
        .map(|t| t == &state.config.auth_token)
        .unwrap_or(false);

    ws.on_upgrade(move |socket| async move {
        if !authenticated {
            tracing::warn!("WebSocket connection rejected: invalid token");
            return;
        }

        tracing::info!("WebSocket client connected");
        let mut rx = state.event_tx.subscribe();
        let (mut sender, mut receiver) = socket.split();

        // Forward events to client
        let send_task = tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                if let Ok(json) = serde_json::to_string(&event) {
                    if sender
                        .send(axum::extract::ws::Message::Text(json.into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }
        });

        // Read client messages (for future use, currently just detect disconnect)
        let recv_task = tokio::spawn(async move {
            while let Some(Ok(_msg)) = receiver.next().await {
                // Client messages ignored in V1
            }
        });

        tokio::select! {
            _ = send_task => {},
            _ = recv_task => {},
        }

        tracing::info!("WebSocket client disconnected");
    })
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/ws", get(ws_handler))
}
