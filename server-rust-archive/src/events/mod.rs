pub mod detector;

use crate::db::models::{Session, SessionMessage, Workspace};
use serde::Serialize;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum Event {
    #[serde(rename = "message.created")]
    MessageCreated(SessionMessage),
    #[serde(rename = "session.updated")]
    SessionUpdated(Session),
    #[serde(rename = "workspace.updated")]
    WorkspaceUpdated(Workspace),
    #[serde(rename = "heartbeat")]
    Heartbeat,
}

pub type EventSender = broadcast::Sender<Event>;

pub fn create_channel() -> (EventSender, broadcast::Receiver<Event>) {
    broadcast::channel(256)
}
