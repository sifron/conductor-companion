use sqlx::SqlitePool;

use super::models::*;

pub async fn list_repos(pool: &SqlitePool) -> anyhow::Result<Vec<Repo>> {
    let repos = sqlx::query_as::<_, Repo>("SELECT * FROM repos ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(repos)
}

pub async fn list_workspaces(pool: &SqlitePool) -> anyhow::Result<Vec<WorkspaceResponse>> {
    let workspaces = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let mut responses = Vec::new();
    for ws in workspaces {
        let repo = if let Some(ref repo_id) = ws.repository_id {
            sqlx::query_as::<_, Repo>("SELECT * FROM repos WHERE id = ?")
                .bind(repo_id)
                .fetch_optional(pool)
                .await?
        } else {
            None
        };

        let session_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0)",
        )
        .bind(&ws.id)
        .fetch_one(pool)
        .await?;

        let active_session_status = if let Some(ref session_id) = ws.active_session_id {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT status FROM sessions WHERE id = ?",
            )
            .bind(session_id)
            .fetch_optional(pool)
            .await?
            .flatten()
        } else {
            None
        };

        responses.push(WorkspaceResponse {
            repo_name: repo.as_ref().and_then(|r| r.name.clone()),
            repo_remote_url: repo.as_ref().and_then(|r| r.remote_url.clone()),
            active_session_status,
            session_count,
            workspace: ws,
        });
    }

    Ok(responses)
}

pub async fn get_workspace(
    pool: &SqlitePool,
    id: &str,
) -> anyhow::Result<Option<WorkspaceResponse>> {
    let ws = sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;

    let ws = match ws {
        Some(ws) => ws,
        None => return Ok(None),
    };

    let repo = if let Some(ref repo_id) = ws.repository_id {
        sqlx::query_as::<_, Repo>("SELECT * FROM repos WHERE id = ?")
            .bind(repo_id)
            .fetch_optional(pool)
            .await?
    } else {
        None
    };

    let session_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0)",
    )
    .bind(&ws.id)
    .fetch_one(pool)
    .await?;

    let active_session_status = if let Some(ref session_id) = ws.active_session_id {
        sqlx::query_scalar::<_, Option<String>>("SELECT status FROM sessions WHERE id = ?")
            .bind(session_id)
            .fetch_optional(pool)
            .await?
            .flatten()
    } else {
        None
    };

    Ok(Some(WorkspaceResponse {
        repo_name: repo.as_ref().and_then(|r| r.name.clone()),
        repo_remote_url: repo.as_ref().and_then(|r| r.remote_url.clone()),
        active_session_status,
        session_count,
        workspace: ws,
    }))
}

pub async fn list_sessions(
    pool: &SqlitePool,
    workspace_id: &str,
) -> anyhow::Result<Vec<Session>> {
    let sessions = sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0) ORDER BY updated_at DESC",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(sessions)
}

pub async fn get_session(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Session>> {
    let session = sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(session)
}

pub async fn list_messages(
    pool: &SqlitePool,
    session_id: &str,
    limit: i64,
    before: Option<&str>,
) -> anyhow::Result<Vec<SessionMessage>> {
    let messages = if let Some(before_id) = before {
        sqlx::query_as::<_, SessionMessage>(
            "SELECT * FROM session_messages WHERE session_id = ? AND rowid < (SELECT rowid FROM session_messages WHERE id = ?) ORDER BY rowid DESC LIMIT ?",
        )
        .bind(session_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, SessionMessage>(
            "SELECT * FROM session_messages WHERE session_id = ? ORDER BY rowid DESC LIMIT ?",
        )
        .bind(session_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };
    Ok(messages)
}

pub async fn get_latest_message_rowid(pool: &SqlitePool) -> anyhow::Result<i64> {
    let rowid = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(rowid), 0) FROM session_messages",
    )
    .fetch_one(pool)
    .await?;
    Ok(rowid)
}

pub async fn get_messages_after_rowid(
    pool: &SqlitePool,
    after_rowid: i64,
) -> anyhow::Result<Vec<SessionMessage>> {
    let messages = sqlx::query_as::<_, SessionMessage>(
        "SELECT * FROM session_messages WHERE rowid > ? ORDER BY rowid ASC",
    )
    .bind(after_rowid)
    .fetch_all(pool)
    .await?;
    Ok(messages)
}

pub async fn get_sessions_updated_after(
    pool: &SqlitePool,
    after: &str,
) -> anyhow::Result<Vec<Session>> {
    let sessions = sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE updated_at > ? ORDER BY updated_at ASC",
    )
    .bind(after)
    .fetch_all(pool)
    .await?;
    Ok(sessions)
}

pub async fn get_workspaces_updated_after(
    pool: &SqlitePool,
    after: &str,
) -> anyhow::Result<Vec<Workspace>> {
    let workspaces = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE updated_at > ? ORDER BY updated_at ASC",
    )
    .bind(after)
    .fetch_all(pool)
    .await?;
    Ok(workspaces)
}
