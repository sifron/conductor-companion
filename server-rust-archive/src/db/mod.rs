pub mod models;
pub mod queries;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;

pub async fn create_pool(db_path: &Path) -> anyhow::Result<SqlitePool> {
    let db_url = format!("sqlite://{}?mode=ro", db_path.display());
    let options = SqliteConnectOptions::from_str(&db_url)?
        .read_only(true)
        .create_if_missing(false);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;

    // Ensure we never write
    sqlx::query("PRAGMA query_only = ON")
        .execute(&pool)
        .await?;

    Ok(pool)
}
