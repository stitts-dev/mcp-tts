fn main() {
    #[cfg(target_os = "macos")]
    {
        // Link CoreML framework — required by ort-sys prebuilt ONNX Runtime
        println!("cargo:rustc-link-lib=framework=CoreML");
        println!("cargo:rustc-link-lib=framework=Foundation");
        // Weak-link MLComputePlan (macOS 15+ only) so we can build with older SDKs
        println!("cargo:rustc-link-arg=-Wl,-U,_OBJC_CLASS_$_MLComputePlan");
    }
}
