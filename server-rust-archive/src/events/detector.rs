use notify::{Event as NotifyEvent, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use sqlx::SqlitePool;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::{Event, EventSender};
use crate::db::queries;

struct DetectorState {
    last_message_rowid: i64,
    last_session_updated: String,
    last_workspace_updated: String,
}

pub async fn start_detector(
    pool: SqlitePool,
    tx: EventSender,
    db_path: &Path,
) -> anyhow::Result<()> {
    // Initialize state
    let last_rowid = queries::get_latest_message_rowid(&pool).await?;
    let state = Arc::new(Mutex::new(DetectorState {
        last_message_rowid: last_rowid,
        last_session_updated: String::new(),
        last_workspace_updated: String::new(),
    }));

    // Set up file watcher on the WAL file
    let wal_path = db_path.with_extension("db-wal");
    let notify_tx = tokio::sync::mpsc::channel::<()>(16);

    let (fs_tx, mut fs_rx) = notify_tx;

    let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res: Result<NotifyEvent, notify::Error>| {
        if let Ok(event) = res {
            if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                let _ = fs_tx.blocking_send(());
            }
        }
    })?;

    // Watch the directory containing the DB (to catch WAL file changes)
    if let Some(parent) = db_path.parent() {
        watcher.watch(parent, RecursiveMode::NonRecursive)?;
    }

    tracing::info!("Change detector started, watching {}", wal_path.display());

    // Spawn the check loop
    let pool_clone = pool.clone();
    let tx_clone = tx.clone();
    let state_clone = state.clone();

    tokio::spawn(async move {
        // Keep watcher alive
        let _watcher = watcher;

        loop {
            tokio::select! {
                // Triggered by filesystem change
                _ = fs_rx.recv() => {
                    // Debounce: drain any additional notifications
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    while fs_rx.try_recv().is_ok() {}

                    check_changes(&pool_clone, &tx_clone, &state_clone).await;
                }
                // Fallback poll every 2 seconds
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                    check_changes(&pool_clone, &tx_clone, &state_clone).await;
                }
            }
        }
    });

    // Spawn heartbeat
    let tx_heartbeat = tx.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let _ = tx_heartbeat.send(Event::Heartbeat);
        }
    });

    Ok(())
}

async fn check_changes(pool: &SqlitePool, tx: &EventSender, state: &Arc<Mutex<DetectorState>>) {
    let mut state = state.lock().await;

    // Check for new messages
    if let Ok(messages) = queries::get_messages_after_rowid(pool, state.last_message_rowid).await {
        for msg in &messages {
            let _ = tx.send(Event::MessageCreated(msg.clone()));
        }
        if let Ok(new_rowid) = queries::get_latest_message_rowid(pool).await {
            if new_rowid > state.last_message_rowid {
                state.last_message_rowid = new_rowid;
            }
        }
    }

    // Check for session updates
    if let Ok(sessions) =
        queries::get_sessions_updated_after(pool, &state.last_session_updated).await
    {
        for session in &sessions {
            let _ = tx.send(Event::SessionUpdated(session.clone()));
            if let Some(ref updated) = session.updated_at {
                if updated > &state.last_session_updated {
                    state.last_session_updated = updated.clone();
                }
            }
        }
    }

    // Check for workspace updates
    if let Ok(workspaces) =
        queries::get_workspaces_updated_after(pool, &state.last_workspace_updated).await
    {
        for ws in &workspaces {
            let _ = tx.send(Event::WorkspaceUpdated(ws.clone()));
            if let Some(ref updated) = ws.updated_at {
                if updated > &state.last_workspace_updated {
                    state.last_workspace_updated = updated.clone();
                }
            }
        }
    }
}
