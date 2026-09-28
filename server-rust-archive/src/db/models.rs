use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Repo {
    pub id: String,
    pub remote_url: Option<String>,
    pub name: Option<String>,
    pub root_path: Option<String>,
    pub default_branch: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Workspace {
    pub id: String,
    pub repository_id: Option<String>,
    pub directory_name: Option<String>,
    pub branch: Option<String>,
    pub state: Option<String>,
    pub active_session_id: Option<String>,
    pub unread: Option<i64>,
    pub derived_status: Option<String>,
    pub pr_title: Option<String>,
    pub pr_description: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub pinned_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: String,
    pub workspace_id: Option<String>,
    pub status: Option<String>,
    pub claude_session_id: Option<String>,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub title: Option<String>,
    pub context_used_percent: Option<f64>,
    pub thinking_enabled: Option<i64>,
    pub fast_mode: Option<i64>,
    pub is_compacting: Option<i64>,
    pub is_hidden: Option<i64>,
    pub last_user_message_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SessionMessage {
    pub id: String,
    pub session_id: Option<String>,
    pub role: Option<String>,
    pub content: Option<String>,
    pub created_at: Option<String>,
    pub sent_at: Option<String>,
    pub cancelled_at: Option<String>,
    pub model: Option<String>,
    pub turn_id: Option<String>,
}

/// API response for a workspace with repo info
#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceResponse {
    #[serde(flatten)]
    pub workspace: Workspace,
    pub repo_name: Option<String>,
    pub repo_remote_url: Option<String>,
    pub active_session_status: Option<String>,
    pub session_count: i64,
}

/// API response for a message with parsed display content
#[derive(Debug, Clone, Serialize)]
pub struct MessageResponse {
    pub id: String,
    pub session_id: Option<String>,
    pub role: Option<String>,
    pub display_content: String,
    pub created_at: Option<String>,
    pub sent_at: Option<String>,
    pub model: Option<String>,
    pub turn_id: Option<String>,
}

impl SessionMessage {
    /// Parse the JSON content field into human-readable display text
    pub fn to_display_content(&self) -> String {
        let content = match &self.content {
            Some(c) => c,
            None => return String::new(),
        };

        // Try parsing as JSON
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(content) {
            return extract_display_text(&value);
        }

        // If not JSON, return as-is (plain text message)
        content.clone()
    }

    pub fn to_response(&self) -> MessageResponse {
        MessageResponse {
            id: self.id.clone(),
            session_id: self.session_id.clone(),
            role: self.role.clone(),
            display_content: self.to_display_content(),
            created_at: self.created_at.clone(),
            sent_at: self.sent_at.clone(),
            model: self.model.clone(),
            turn_id: self.turn_id.clone(),
        }
    }
}

fn extract_display_text(value: &serde_json::Value) -> String {
    // Handle string content directly
    if let Some(s) = value.as_str() {
        return s.to_string();
    }

    // Handle array of content blocks (Claude API format)
    if let Some(arr) = value.as_array() {
        let texts: Vec<String> = arr
            .iter()
            .filter_map(|block| {
                if let Some(block_type) = block.get("type").and_then(|t| t.as_str()) {
                    match block_type {
                        "text" => block.get("text").and_then(|t| t.as_str()).map(String::from),
                        "tool_use" => {
                            let name = block
                                .get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("unknown");
                            Some(format!("[Tool: {}]", name))
                        }
                        "tool_result" => None, // Skip tool results
                        _ => None,
                    }
                } else {
                    None
                }
            })
            .collect();
        if !texts.is_empty() {
            return texts.join("\n");
        }
    }

    // Handle object with nested message content
    if let Some(obj) = value.as_object() {
        // Check for message.content pattern
        if let Some(message) = obj.get("message") {
            if let Some(content) = message.get("content") {
                return extract_display_text(content);
            }
        }

        // Check for direct content field
        if let Some(content) = obj.get("content") {
            return extract_display_text(content);
        }

        // Check for text field
        if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
            return text.to_string();
        }
    }

    // Fallback: return truncated JSON
    let s = value.to_string();
    if s.len() > 200 {
        format!("{}...", &s[..200])
    } else {
        s
    }
}
