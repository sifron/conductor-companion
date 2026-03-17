use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub bind_address: String,
    pub conductor_db_path: String,
    pub auth_token: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 3847,
            bind_address: "0.0.0.0".to_string(),
            conductor_db_path: detect_conductor_db_path()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            auth_token: generate_token(),
        }
    }
}

fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn detect_conductor_db_path() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        let home = dirs::home_dir()?;
        let path = home
            .join("Library")
            .join("Application Support")
            .join("com.conductor.app")
            .join("conductor.db");
        if path.exists() {
            return Some(path);
        }
    }
    // Linux fallback
    if let Some(data_dir) = dirs::data_dir() {
        let path = data_dir.join("com.conductor.app").join("conductor.db");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

fn config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("conductor-companion");
    config_dir.join("config.toml")
}

impl Config {
    pub fn load_or_create() -> anyhow::Result<Self> {
        let path = config_path();

        if path.exists() {
            let contents = std::fs::read_to_string(&path)?;
            let config: Config = toml::from_str(&contents)?;
            Ok(config)
        } else {
            let config = Config::default();
            config.save()?;
            tracing::info!("Created new config at {}", path.display());
            tracing::info!("Auth token: {}", config.auth_token);
            Ok(config)
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let path = config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let contents = toml::to_string_pretty(self)?;
        std::fs::write(&path, contents)?;
        Ok(())
    }

    pub fn db_path(&self) -> &Path {
        Path::new(&self.conductor_db_path)
    }
}
