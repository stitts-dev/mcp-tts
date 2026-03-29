//! Piper TTS CLI — reads text from stdin, writes WAV to output file.
//!
//! Voice models are downloaded from HuggingFace on first use and cached
//! in ~/.claude/piper-voices/.

use std::io::Read;
use std::path::PathBuf;

use clap::Parser;

#[derive(Parser)]
#[command(about = "Local TTS via piper-rs")]
struct Args {
    /// Voice model name (e.g. en_US-norman-medium)
    #[arg(long, default_value = "en_US-norman-medium")]
    voice: String,

    /// Output WAV file path (not required with --download-only)
    #[arg(long, required_unless_present = "download_only")]
    output: Option<PathBuf>,

    /// Speech speed (1.0 = normal, higher = faster)
    #[arg(long, default_value = "1.0")]
    speed: f32,

    /// Noise scale — phoneme variation/expressiveness (0.0-1.0, default 0.667)
    #[arg(long)]
    noise_scale: Option<f32>,

    /// Noise W — phoneme duration variation (0.0-1.0, default 0.8)
    #[arg(long)]
    noise_w: Option<f32>,

    /// Only download the voice model, don't synthesize
    #[arg(long)]
    download_only: bool,
}

struct VoiceModel {
    name: &'static str,
    onnx_path: &'static str,
    config_path: &'static str,
}

const VOICES: &[VoiceModel] = &[
    VoiceModel {
        name: "en_US-l2arctic-medium",
        onnx_path: "en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx",
        config_path: "en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx.json",
    },
    VoiceModel {
        name: "en_US-norman-medium",
        onnx_path: "en/en_US/norman/medium/en_US-norman-medium.onnx",
        config_path: "en/en_US/norman/medium/en_US-norman-medium.onnx.json",
    },
    VoiceModel {
        name: "en_US-kusal-medium",
        onnx_path: "en/en_US/kusal/medium/en_US-kusal-medium.onnx",
        config_path: "en/en_US/kusal/medium/en_US-kusal-medium.onnx.json",
    },
    VoiceModel {
        name: "en_US-lessac-high",
        onnx_path: "en/en_US/lessac/high/en_US-lessac-high.onnx",
        config_path: "en/en_US/lessac/high/en_US-lessac-high.onnx.json",
    },
    VoiceModel {
        name: "en_US-ryan-high",
        onnx_path: "en/en_US/ryan/high/en_US-ryan-high.onnx",
        config_path: "en/en_US/ryan/high/en_US-ryan-high.onnx.json",
    },
    VoiceModel {
        name: "en_US-ljspeech-high",
        onnx_path: "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx",
        config_path: "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx.json",
    },
];

const HF_BASE: &str = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

fn voices_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".claude").join("piper-voices")
}

fn download_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    eprintln!("piper-cli: downloading {}", url);
    let resp = ureq::get(url)
        .call()
        .map_err(|e| format!("Download failed: {e}"))?;

    let mut bytes = Vec::new();
    resp.into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Read failed: {e}"))?;

    std::fs::write(dest, &bytes).map_err(|e| format!("Write failed: {e}"))?;
    eprintln!("piper-cli: saved {} ({:.1} MB)", dest.display(), bytes.len() as f64 / 1_048_576.0);
    Ok(())
}

fn ensure_model(voice: &VoiceModel) -> Result<(PathBuf, PathBuf), String> {
    let dir = voices_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;

    let onnx = dir.join(format!("{}.onnx", voice.name));
    let config = dir.join(format!("{}.onnx.json", voice.name));

    if !onnx.exists() {
        download_file(&format!("{}/{}", HF_BASE, voice.onnx_path), &onnx)?;
    }
    if !config.exists() {
        download_file(&format!("{}/{}", HF_BASE, voice.config_path), &config)?;
    }

    Ok((onnx, config))
}

fn main() {
    let args = Args::parse();

    let voice = VOICES
        .iter()
        .find(|v| v.name == args.voice)
        .unwrap_or_else(|| {
            eprintln!(
                "piper-cli: unknown voice '{}'. Available: {}",
                args.voice,
                VOICES.iter().map(|v| v.name).collect::<Vec<_>>().join(", ")
            );
            std::process::exit(1);
        });

    let (onnx_path, config_path) = ensure_model(voice).unwrap_or_else(|e| {
        eprintln!("piper-cli: model error: {e}");
        std::process::exit(1);
    });

    if args.download_only {
        eprintln!("piper-cli: model ready for '{}'", args.voice);
        return;
    }

    // Read text from stdin
    let mut text = String::new();
    std::io::stdin().read_to_string(&mut text).unwrap_or_else(|e| {
        eprintln!("piper-cli: stdin error: {e}");
        std::process::exit(1);
    });
    let text = text.trim();
    if text.is_empty() {
        eprintln!("piper-cli: no text provided");
        std::process::exit(1);
    }

    // Load model and synthesize
    let mut model = piper_rs::Piper::new(onnx_path.as_path(), config_path.as_path())
        .unwrap_or_else(|e| {
            eprintln!("piper-cli: model load failed: {e}");
            std::process::exit(1);
        });

    let length_scale = if args.speed > 0.0 {
        Some(1.0 / args.speed)
    } else {
        None
    };

    let (samples, sample_rate) = model
        .create(text, false, None, length_scale, args.noise_scale, args.noise_w)
        .unwrap_or_else(|e| {
            eprintln!("piper-cli: synthesis failed: {e}");
            std::process::exit(1);
        });

    // Write WAV
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut writer = hound::WavWriter::create(args.output.as_ref().unwrap(), spec).unwrap_or_else(|e| {
        eprintln!("piper-cli: WAV write failed: {e}");
        std::process::exit(1);
    });
    for sample in &samples {
        writer.write_sample(*sample).unwrap();
    }
    writer.finalize().unwrap();
}
