use axum::{extract::State, response::Html, routing::get, Router};
use qrcode::QrCode;

use crate::AppState;

async fn setup_page(State(state): State<AppState>) -> Html<String> {
    let local_ip = get_local_ip().unwrap_or_else(|| "localhost".to_string());

    let connection_info = serde_json::json!({
        "host": local_ip,
        "port": state.config.port,
        "token": state.config.auth_token,
    });

    let qr_data = connection_info.to_string();
    let qr_svg = generate_qr_svg(&qr_data);

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Conductor Companion Setup</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }}
        .container {{
            text-align: center;
            max-width: 500px;
            padding: 2rem;
        }}
        h1 {{
            color: #fff;
            margin-bottom: 0.5rem;
        }}
        .subtitle {{
            color: #888;
            margin-bottom: 2rem;
        }}
        .qr-container {{
            background: white;
            border-radius: 16px;
            padding: 24px;
            display: inline-block;
            margin: 1rem 0;
        }}
        .qr-container svg {{
            width: 256px;
            height: 256px;
        }}
        .info {{
            background: #16213e;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            text-align: left;
            font-family: monospace;
            font-size: 0.9rem;
        }}
        .info .label {{
            color: #888;
            font-size: 0.8rem;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Conductor Companion</h1>
        <p class="subtitle">Scan this QR code with the mobile app to connect</p>
        <div class="qr-container">
            {qr_svg}
        </div>
        <div class="info">
            <div class="label">Server Address</div>
            <div>{local_ip}:{port}</div>
            <br>
            <div class="label">Auth Token</div>
            <div>{token}</div>
        </div>
    </div>
</body>
</html>"#,
        qr_svg = qr_svg,
        local_ip = local_ip,
        port = state.config.port,
        token = state.config.auth_token,
    );

    Html(html)
}

fn generate_qr_svg(data: &str) -> String {
    match QrCode::new(data.as_bytes()) {
        Ok(code) => {
            let svg = code
                .render::<qrcode::render::svg::Color>()
                .min_dimensions(256, 256)
                .build();
            svg
        }
        Err(_) => "<p>Failed to generate QR code</p>".to_string(),
    }
}

fn get_local_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let addr = socket.local_addr().ok()?;
    Some(addr.ip().to_string())
}

pub fn router() -> Router<AppState> {
    Router::new().route("/setup", get(setup_page))
}
