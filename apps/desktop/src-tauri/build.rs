fn main() {
    // Keep direct Cargo/release-binary launches inside the build tree isolated too. Installed
    // bundles run outside this directory and retain the configured production identity.
    let out_dir = std::path::PathBuf::from(std::env::var_os("OUT_DIR").expect("Cargo OUT_DIR"));
    let build_directory = out_dir.ancestors().nth(3).expect("Cargo profile directory");
    println!(
        "cargo:rustc-env=EASYTRIM_BUILD_DIRECTORY={}",
        build_directory.display()
    );
    tauri_build::build()
}
