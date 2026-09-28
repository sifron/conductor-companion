mod api;
mod auth;
mod config;
mod db;
mod events;

use axum::middleware;
use sqlx::SqlitePool;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use config::Config;
use events::EventSender;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub event_tx: EventSender,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "conductor_companion_server=info".into()),
        )
        .init();

    let config = Config::load_or_create()?;

    // Validate DB exists
    if !config.db_path().exists() {
        tracing::error!(
            "Conductor database not found at {}",
            config.conductor_db_path
        );
        tracing::error!("Make sure Conductor is installed and has been run at least once.");
        std::process::exit(1);
    }

    let pool = db::create_pool(config.db_path()).await?;
    let (event_tx, _) = events::create_channel();

    let config = Arc::new(config);
    let state = AppState {
        db: pool.clone(),
        config: config.clone(),
        event_tx: event_tx.clone(),
    };

    // Start change detector
    events::detector::start_detector(pool, event_tx, config.db_path()).await?;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = api::router()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ))
        .layer(cors)
        .with_state(state);

    let addr = format!("{}:{}", config.bind_address, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("========================================");
    tracing::info!("  Conductor Companion Server v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("  Listening on {}", addr);
    tracing::info!("  Setup page: http://localhost:{}/setup", config.port);
    tracing::info!("  Auth token: {}", config.auth_token);
    tracing::info!("========================================");

    axum::serve(listener, app).await?;

    Ok(())
}
